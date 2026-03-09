<?php
/**
 * Project Members API Endpoint
 * GET /api/projects/members.php?project_id={id} - List eligible members for a project (workspace members)
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $current_user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $project_id = $_GET['project_id'] ?? null;

    if (empty($project_id)) {
      send_validation_error(['project_id' => 'Project ID is required']);
    }

    // Step 1: Find the workspace this project belongs to, and verify access
    $stmt = $db->prepare("
        SELECT p.workspace_id, wm.role 
        FROM projects p
        INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE p.id = ? AND wm.user_id = ?
    ");
    $stmt->execute([$project_id, $current_user_id]);
    $project_access = $stmt->fetch();

    if (!$project_access) {
      send_error('Project access denied or project not found', 403);
    }

    $workspace_id = $project_access['workspace_id'];

    // Step 2: Fetch all members of this workspace. 
    // These are the eligible assignees for tasks within this project.
    $stmt = $db->prepare("
      SELECT u.id, u.first_name, u.last_name, u.email, wm.role as workspace_role
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY u.first_name ASC, u.last_name ASC
    ");
    $stmt->execute([$workspace_id]);
    $members = $stmt->fetchAll();

    send_success(['members' => $members]);
  } 
  else {
    send_error('Method not allowed', 405);
  }

} catch (Exception $e) {
  error_log('Project Members endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
