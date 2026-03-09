<?php
/**
 * Delete Workspace API Endpoint
 * DELETE /api/workspaces/delete.php?id={id}
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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
    WHERE w.id = ? AND wm.user_id = ? AND wm.role = 'admin'
    LIMIT 1
  ");
  $stmt->execute([$workspace_id, $user_id]);
  $existing_workspace = $stmt->fetch();

  if (!$existing_workspace) {
    send_error('Workspace not found or you do not have permission to delete it', 404);
  }

  // Hard delete via DB cascading to projects, tasks, etc.
  $stmt = $db->prepare("DELETE FROM workspaces WHERE id = ?");
  $stmt->execute([$workspace_id]);

  send_success(['message' => 'Workspace deleted successfully']);

} catch (Exception $e) {
  error_log('Workspaces delete endpoint error: ' . $e->getMessage());
  send_error('An error occurred while deleting the workspace.', 500);
}
