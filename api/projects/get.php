<?php
/**
 * Get Project API Endpoint
 * GET /api/projects/get.php?id={id}
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_error('Method not allowed', 405);
  }

  $project_id = $_GET['id'] ?? null;

  if (empty($project_id)) {
    send_validation_error(['id' => 'Project ID is required']);
  }

  // Get project details, verify access through workspace membership
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
    WHERE p.id = ? AND wm.user_id = ?
    LIMIT 1
  ");
  $stmt->execute([$project_id, $user_id]);
  $project = $stmt->fetch();

  if (!$project) {
    send_error('Project not found or access denied', 404);
  }

  send_success(['project' => $project]);

} catch (Exception $e) {
  error_log('Projects get endpoint error: ' . $e->getMessage());
  send_error('An error occurred while fetching the project.', 500);
}
