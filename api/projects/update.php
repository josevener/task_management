<?php
/**
 * Update Project API Endpoint
 * PUT /api/projects/update.php?id={id}
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    send_error('Method not allowed', 405);
  }

  $project_id = $_GET['id'] ?? null;

  if (empty($project_id)) {
    send_validation_error(['id' => 'Project ID is required']);
  }

  // Verify Project exists and user is owner or workspace admin/manager
  $stmt = $db->prepare("
    SELECT p.id, pm.role as project_role, wm.role as workspace_role, p.workspace_id
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
    WHERE p.id = ?
    LIMIT 1
  ");
  $stmt->execute([$user_id, $user_id, $project_id]);
  $existing_project = $stmt->fetch();

  if (!$existing_project) {
    send_error('Project not found or access denied', 404);
  }

  // Check permissions: Must be project owner OR workspace admin/manager
  $can_edit = ($existing_project['project_role'] === 'owner' || 
               $existing_project['workspace_role'] === 'admin' || 
               $existing_project['workspace_role'] === 'manager');
               
  if (!$can_edit) {
      send_error('You do not have permission to edit this project', 403);
  }

  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    send_error('Invalid JSON input', 400);
  }

  $updates = [];
  $params = [];
  $allowed_fields = ['name', 'description', 'status', 'start_date', 'end_date', 'progress_percentage', 'health_status'];

  foreach ($allowed_fields as $field) {
    if (isset($input[$field])) {
      if ($field === 'name') {
        $value = trim($input[$field]);
        if (empty($value)) {
          send_validation_error(['name' => 'Project name cannot be empty']);
        }
      } elseif ($field === 'status') {
        $valid_statuses = ['active', 'on_hold', 'completed', 'archived'];
        if (!in_array($input[$field], $valid_statuses)) {
          send_validation_error(['status' => 'Invalid status']);
        }
      } elseif ($field === 'health_status') {
        $valid_health = ['on_track', 'at_risk', 'off_track', 'not_set'];
        if (!in_array($input[$field], $valid_health)) {
          send_validation_error(['health_status' => 'Invalid health status']);
        }
      }
      
      $updates[] = "{$field} = ?";
      $params[] = $input[$field] === '' ? null : $input[$field];
    }
  }

  if (empty($updates)) {
    send_error('No fields to update', 400);
  }

  $params[] = $project_id;
  $update_clause = implode(', ', $updates);
  
  $db->beginTransaction();

  $stmt = $db->prepare("
    UPDATE projects 
    SET {$update_clause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  ");
  $stmt->execute($params);

  // Log activity
  $stmt = $db->prepare("
    INSERT INTO activity_logs (user_id, workspace_id, project_id, activity_type, description)
    VALUES (?, ?, ?, 'project_updated', 'Project details were updated')
  ");
  $stmt->execute([$user_id, $existing_project['workspace_id'], $project_id]);

  $db->commit();

  // Return updated project
  $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
  $stmt->execute([$project_id]);
  $project = $stmt->fetch();

  send_success(['project' => $project]);

} catch (Exception $e) {
  if (isset($db) && $db->inTransaction()) {
      $db->rollBack();
  }
  error_log('Projects update endpoint error: ' . $e->getMessage());
  send_error('An error occurred while updating the project.', 500);
}
