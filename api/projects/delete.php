<?php
/**
 * Delete Project API Endpoint
 * DELETE /api/projects/delete.php?id={id}
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

  $project_id = $_GET['id'] ?? null;

  if (empty($project_id)) {
    send_validation_error(['id' => 'Project ID is required']);
  }

  // Verify Project exists and user is owner or workspace admin
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

  $can_delete = ($existing_project['project_role'] === 'owner' || 
                 $existing_project['workspace_role'] === 'admin');

  if (!$can_delete) {
      send_error('You do not have permission to delete this project', 403);
  }

  $workspace_id = $existing_project['workspace_id'];

  $db->beginTransaction();

  // Log activity BEFORE deleting so it's tied to the workspace context 
  $stmt = $db->prepare("
    INSERT INTO activity_logs (user_id, workspace_id, activity_type, description)
    VALUES (?, ?, 'project_deleted', 'A project was deleted')
  ");
  $stmt->execute([$user_id, $workspace_id]);

  // Hard delete via DB cascading to tasks, members, etc.
  $stmt = $db->prepare("DELETE FROM projects WHERE id = ?");
  $stmt->execute([$project_id]);

  $db->commit();

  send_success(['message' => 'Project deleted successfully']);

} catch (Exception $e) {
  if (isset($db) && $db->inTransaction()) {
      $db->rollBack();
  }
  error_log('Projects delete endpoint error: ' . $e->getMessage());
  send_error('An error occurred while deleting the project.', 500);
}
