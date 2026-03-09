<?php
/**
 * Update Workspace API Endpoint
 * PUT /api/workspaces/update.php?id={id}
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

  $workspace_id = $_GET['id'] ?? null;

  if (empty($workspace_id)) {
    send_validation_error(['id' => 'Workspace ID is required']);
  }

  // Verify Workspace exists and user is admin 
  $stmt = $db->prepare("
    SELECT w.id, wm.role 
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ? AND (wm.role = 'admin' OR wm.role = 'manager')
    LIMIT 1
  ");
  $stmt->execute([$workspace_id, $user_id]);
  $existing_workspace = $stmt->fetch();

  if (!$existing_workspace) {
    send_error('Workspace not found or you do not have permission to edit it', 404);
  }

  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    send_error('Invalid JSON input', 400);
  }

  $updates = [];
  $params = [];
  $allowed_fields = ['name', 'slug', 'description', 'color_theme', 'logo_url'];

  foreach ($allowed_fields as $field) {
    if (isset($input[$field])) {
      if ($field === 'name') {
        $value = trim($input[$field]);
        if (empty($value)) {
          send_validation_error(['name' => 'Workspace name cannot be empty']);
        }
      } elseif ($field === 'slug') {
        $value = trim($input[$field]);
        if (empty($value)) {
           send_validation_error(['slug' => 'Slug cannot be empty']);
        }
        // Check for unique slug per organization excluding current
        $orgStmt = $db->prepare('SELECT organization_id FROM workspaces WHERE id = ?');
        $orgStmt->execute([$workspace_id]);
        $org_id = $orgStmt->fetchColumn();

        $slugCheck = $db->prepare('SELECT id FROM workspaces WHERE slug = ? AND organization_id = ? AND id != ?');
        $slugCheck->execute([$value, $org_id, $workspace_id]);
        if ($slugCheck->fetch()) {
            send_validation_error(['slug' => 'Slug must be unique within the organization']);
        }
      }
      
      $updates[] = "{$field} = ?";
      $params[] = $input[$field] ?: null;
    }
  }

  if (empty($updates)) {
    send_error('No fields to update', 400);
  }

  $params[] = $workspace_id;
  $update_clause = implode(', ', $updates);
  
  $stmt = $db->prepare("
    UPDATE workspaces 
    SET {$update_clause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  ");
  $stmt->execute($params);

  // Return updated workspace
  $stmt = $db->prepare("SELECT * FROM workspaces WHERE id = ?");
  $stmt->execute([$workspace_id]);
  $workspace = $stmt->fetch();

  send_success(['workspace' => $workspace]);

} catch (Exception $e) {
  error_log('Workspaces update endpoint error: ' . $e->getMessage());
  send_error('An error occurred while updating the workspace.', 500);
}
