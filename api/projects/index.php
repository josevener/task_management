<?php
/**
 * Projects API Endpoint
 * GET /api/projects - List projects
 * POST /api/projects - Create a new project
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
    // List projects the user has access to
    $workspace_id = $_GET['workspace_id'] ?? null;

    if ($workspace_id) {
      // Verify user has access to workspace
      $stmt = $db->prepare("
        SELECT wm.role FROM workspace_members wm
        WHERE wm.workspace_id = ? AND wm.user_id = ?
      ");
      $stmt->execute([$workspace_id, $user_id]);
      if (!$stmt->fetch()) {
        send_error('Workspace access denied', 403);
      }

      // Get projects in workspace
      $stmt = $db->prepare("
        SELECT p.id, p.workspace_id, p.name, p.description, p.status,
               p.owner_id, p.start_date, p.end_date, p.progress_percentage,
               p.health_status, p.is_template, p.created_at, p.updated_at,
               u.first_name as owner_first_name, u.last_name as owner_last_name,
               u.email as owner_email
        FROM projects p
        LEFT JOIN users u ON u.id = p.owner_id
        WHERE p.workspace_id = ?
        ORDER BY p.created_at DESC
      ");
      $stmt->execute([$workspace_id]);
    } else {
      // Get all projects user has access to (through workspace membership)
      $stmt = $db->prepare("
        SELECT p.id, p.workspace_id, p.name, p.description, p.status,
               p.owner_id, p.start_date, p.end_date, p.progress_percentage,
               p.health_status, p.is_template, p.created_at, p.updated_at,
               u.first_name as owner_first_name, u.last_name as owner_last_name,
               u.email as owner_email,
               w.name as workspace_name
        FROM projects p
        INNER JOIN workspaces w ON w.id = p.workspace_id
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN users u ON u.id = p.owner_id
        WHERE wm.user_id = ?
        ORDER BY p.created_at DESC
      ");
      $stmt->execute([$user_id]);
    }

    $projects = $stmt->fetchAll();
    send_success(['projects' => $projects]);
  } 
  elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create a new project
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
      send_error('Invalid JSON input', 400);
    }

    $workspace_id = $input['workspace_id'] ?? null;
    $name = trim($input['name'] ?? '');
    $description = trim($input['description'] ?? '');
    $status = $input['status'] ?? 'active';
    $start_date = $input['start_date'] ?? null;
    $end_date = $input['end_date'] ?? null;
    $is_template = isset($input['is_template']) ? (bool)$input['is_template'] : false;

    // Validate input
    $errors = [];
    
    if (empty($workspace_id)) {
      $errors['workspace_id'] = 'Workspace ID is required';
    }

    if (empty($name)) {
      $errors['name'] = 'Project name is required';
    } elseif (strlen($name) > 255) {
      $errors['name'] = 'Project name must be 255 characters or less';
    }

    // Validate status
    $valid_statuses = ['active', 'on_hold', 'completed', 'archived'];
    if (!in_array($status, $valid_statuses)) {
      $errors['status'] = 'Invalid status. Must be one of: ' . implode(', ', $valid_statuses);
    }

    // Validate dates
    if ($start_date && !strtotime($start_date)) {
      $errors['start_date'] = 'Invalid start date format';
    }
    if ($end_date && !strtotime($end_date)) {
      $errors['end_date'] = 'Invalid end date format';
    }
    if ($start_date && $end_date && strtotime($start_date) > strtotime($end_date)) {
      $errors['end_date'] = 'End date must be after start date';
    }

    // Verify workspace access
    if ($workspace_id) {
      $stmt = $db->prepare("
        SELECT wm.role FROM workspace_members wm
        WHERE wm.workspace_id = ? AND wm.user_id = ?
      ");
      $stmt->execute([$workspace_id, $user_id]);
      $member = $stmt->fetch();
      
      if (!$member) {
        $errors['workspace_id'] = 'Workspace access denied';
      }
    }

    if (!empty($errors)) {
      send_validation_error($errors);
    }

    // Create project
    $db->beginTransaction();
    
    try {
      $stmt = $db->prepare("
        INSERT INTO projects (workspace_id, name, description, status, owner_id, start_date, end_date, is_template)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ");
      $stmt->execute([
        $workspace_id, 
        $name, 
        $description, 
        $status, 
        $user_id, 
        $start_date ?: null, 
        $end_date ?: null,
        $is_template ? 1 : 0
      ]);
      $project_id = $db->lastInsertId();

      // Add creator as project member (owner)
      $stmt = $db->prepare("
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (?, ?, 'owner')
      ");
      $stmt->execute([$project_id, $user_id]);

      // Log activity
      $stmt = $db->prepare("
        INSERT INTO activity_logs (user_id, workspace_id, project_id, activity_type, description)
        VALUES (?, ?, ?, 'project_created', ?)
      ");
      $description = "Project '{$name}' was created";
      $stmt->execute([$user_id, $workspace_id, $project_id, $description]);

      $db->commit();

      // Get created project
      $stmt = $db->prepare("
        SELECT p.id, p.workspace_id, p.name, p.description, p.status,
               p.owner_id, p.start_date, p.end_date, p.progress_percentage,
               p.health_status, p.is_template, p.created_at, p.updated_at,
               u.first_name as owner_first_name, u.last_name as owner_last_name,
               u.email as owner_email
        FROM projects p
        LEFT JOIN users u ON u.id = p.owner_id
        WHERE p.id = ?
      ");
      $stmt->execute([$project_id]);
      $project = $stmt->fetch();

      send_success(['project' => $project], 201);
    } catch (Exception $e) {
      $db->rollBack();
      throw $e;
    }
  } 
  else {
    send_error('Method not allowed', 405);
  }
} catch (Exception $e) {
  error_log('Projects endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
