<?php
/**
 * Organizations API Endpoint
 * GET /api/organizations - List user's organizations
 * POST /api/organizations - Create a new organization
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
    // List organizations the user belongs to
    // For MVP, we'll get organizations through workspace memberships
    $stmt = $db->prepare("
      SELECT DISTINCT o.id, o.name, o.slug, o.logo_url, o.subscription_tier, o.created_at
      FROM organizations o
      INNER JOIN workspaces w ON w.organization_id = o.id
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = ? AND o.is_active = TRUE
      ORDER BY o.created_at DESC
    ");
    $stmt->execute([$user_id]);
    $organizations = $stmt->fetchAll();

    send_success(['organizations' => $organizations]);
  } 
  elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create a new organization
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
      send_error('Invalid JSON input', 400);
    }

    $name = trim($input['name'] ?? '');
    $slug = trim($input['slug'] ?? '');

    // Validate input
    $errors = [];
    if (empty($name)) {
      $errors['name'] = 'Organization name is required';
    } elseif (strlen($name) > 255) {
      $errors['name'] = 'Organization name must be 255 characters or less';
    }

    if (empty($slug)) {
      // Generate slug from name if not provided
      $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
      $slug = trim($slug, '-');
    }

    if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
      $errors['slug'] = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    if (!empty($errors)) {
      send_validation_error($errors);
    }

    // Check if slug already exists
    $stmt = $db->prepare("SELECT id FROM organizations WHERE slug = ?");
    $stmt->execute([$slug]);
    if ($stmt->fetch()) {
      send_validation_error(['slug' => 'This slug is already taken']);
    }

    // Create organization
    $db->beginTransaction();
    
    try {
      $stmt = $db->prepare("
        INSERT INTO organizations (name, slug)
        VALUES (?, ?)
      ");
      $stmt->execute([$name, $slug]);
      $organization_id = $db->lastInsertId();

      // Create a default workspace for the organization
      $workspace_name = $name . ' Workspace';
      $workspace_slug = $slug . '-workspace';
      
      $stmt = $db->prepare("
        INSERT INTO workspaces (organization_id, name, slug)
        VALUES (?, ?, ?)
      ");
      $stmt->execute([$organization_id, $workspace_name, $workspace_slug]);
      $workspace_id = $db->lastInsertId();

      // Add creator as admin of the workspace
      $stmt = $db->prepare("
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (?, ?, 'admin')
      ");
      $stmt->execute([$workspace_id, $user_id]);

      $db->commit();

      // Get created organization
      $stmt = $db->prepare("
        SELECT id, name, slug, logo_url, subscription_tier, created_at
        FROM organizations
        WHERE id = ?
      ");
      $stmt->execute([$organization_id]);
      $organization = $stmt->fetch();

      send_success(['organization' => $organization], 201);
    } catch (Exception $e) {
      $db->rollBack();
      throw $e;
    }
  } 
  else {
    send_error('Method not allowed', 405);
  }
} catch (Exception $e) {
  error_log('Organizations endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
