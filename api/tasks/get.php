<?php
/**
 * Get Task API Endpoint
 * GET /api/tasks/get.php?id={id}
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

  $task_id = $_GET['id'] ?? null;

  if (empty($task_id)) {
    send_validation_error(['id' => 'Task ID is required']);
  }

  // Get task details, verify access through workspace membership
  $stmt = $db->prepare("
    SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
           t.status, t.priority, t.assignee_id, t.start_date, t.due_date,
           t.position, t.created_by, t.created_at, t.updated_at,
           assignee.first_name as assignee_first_name,
           assignee.last_name as assignee_last_name,
           assignee.email as assignee_email,
           creator.first_name as creator_first_name,
           creator.last_name as creator_last_name,
           creator.email as creator_email,
           p.name as project_name
    FROM tasks t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.created_by
    LEFT JOIN projects p ON p.id = t.project_id
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE t.id = ? AND wm.user_id = ?
    LIMIT 1
  ");
  $stmt->execute([$task_id, $user_id]);
  $task = $stmt->fetch();

  if (!$task) {
    send_error('Task not found or access denied', 404);
  }

  // Get tags for the task
  $stmt = $db->prepare("
    SELECT tt.id, tt.name, tt.color
    FROM task_tags tt
    INNER JOIN task_tag_assignments tta ON tta.tag_id = tt.id
    WHERE tta.task_id = ?
  ");
  $stmt->execute([$task_id]);
  $task['tags'] = $stmt->fetchAll();

  send_success(['task' => $task]);

} catch (Exception $e) {
  error_log('Tasks get endpoint error: ' . $e->getMessage());
  send_error('An error occurred while fetching the task.', 500);
}
