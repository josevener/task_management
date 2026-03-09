<?php
/**
 * Workspaces API Endpoint
 * GET /api/workspaces - List user's workspaces
 * POST /api/workspaces - Create a new workspace
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // List workspaces the user belongs to
    $organization_id = $_GET['organization_id'] ?? null;

    if ($organization_id) {
      // Get workspaces for a specific organization
      $stmt = $db->prepare("
        SELECT w.id, w.organization_id, w.name, w.slug, w.description, 
               w.logo_url, w.color_theme, w.created_at,
               o.name as organization_name
        FROM workspaces w
        INNER JOIN organizations o ON o.id = w.organization_id
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = ? AND w.organization_id = ? AND w.is_active = TRUE
        ORDER BY w.created_at DESC
      ");
      $stmt->execute([$user_id, $organization_id]);
    } else {
      // Get all workspaces for the user
      $stmt = $db->prepare("
        SELECT w.id, w.organization_id, w.name, w.slug, w.description,
               w.logo_url, w.color_theme, w.created_at,
               o.name as organization_name
        FROM workspaces w
        INNER JOIN organizations o ON o.id = w.organization_id
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = ? AND w.is_active = TRUE
        ORDER BY w.created_at DESC
      ");
      $stmt->execute([$user_id]);
    }

    $workspaces = $stmt->fetchAll();
    send_success(['workspaces' => $workspaces]);
  } 
  elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create a new workspace
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
      send_error('Invalid JSON input', 400);
    }

    $organization_id = $input['organization_id'] ?? null;
    $name = trim($input['name'] ?? '');
    $slug = trim($input['slug'] ?? '');
    $description = trim($input['description'] ?? '');
    $color_theme = $input['color_theme'] ?? 'blue';

    // Validate input
    $errors = [];
    
    if (empty($organization_id)) {
      $errors['organization_id'] = 'Organization ID is required';
    }

    if (empty($name)) {
      $errors['name'] = 'Workspace name is required';
    } elseif (strlen($name) > 255) {
      $errors['name'] = 'Workspace name must be 255 characters or less';
    }

    if (empty($slug)) {
      // Generate slug from name if not provided
      $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
      $slug = trim($slug, '-');
    }

    if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
      $errors['slug'] = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    // Validate organization exists and user has access
    if ($organization_id) {
      $stmt = $db->prepare("
        SELECT o.id FROM organizations o
        INNER JOIN workspaces w ON w.organization_id = o.id
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE o.id = ? AND wm.user_id = ? AND o.is_active = TRUE
        LIMIT 1
      ");
      $stmt->execute([$organization_id, $user_id]);
      if (!$stmt->fetch()) {
        $errors['organization_id'] = 'Organization not found or access denied';
      }
    }

    if (!empty($errors)) {
      send_validation_error($errors);
    }

    // Check if slug already exists for this organization
    $stmt = $db->prepare("
      SELECT id FROM workspaces 
      WHERE organization_id = ? AND slug = ?
    ");
    $stmt->execute([$organization_id, $slug]);
    if ($stmt->fetch()) {
      send_validation_error(['slug' => 'This slug is already taken in this organization']);
    }

    // Create workspace
    $db->beginTransaction();
    
    try {
      $stmt = $db->prepare("
        INSERT INTO workspaces (organization_id, name, slug, description, color_theme)
        VALUES (?, ?, ?, ?, ?)
      ");
      $stmt->execute([$organization_id, $name, $slug, $description, $color_theme]);
      $workspace_id = $db->lastInsertId();

      // Add creator as admin of the workspace
      $stmt = $db->prepare("
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (?, ?, 'admin')
      ");
      $stmt->execute([$workspace_id, $user_id]);

      $db->commit();

      // Get created workspace
      $stmt = $db->prepare("
        SELECT w.id, w.organization_id, w.name, w.slug, w.description,
               w.logo_url, w.color_theme, w.created_at,
               o.name as organization_name
        FROM workspaces w
        INNER JOIN organizations o ON o.id = w.organization_id
        WHERE w.id = ?
      ");
      $stmt->execute([$workspace_id]);
      $workspace = $stmt->fetch();

      send_success(['workspace' => $workspace], 201);
    } catch (Exception $e) {
      $db->rollBack();
      throw $e;
    }
  } 
  else {
    send_error('Method not allowed', 405);
  }
} catch (Exception $e) {
  error_log('Workspaces endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
