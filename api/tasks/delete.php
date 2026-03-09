<?php
/**
 * Delete Task API Endpoint
 * DELETE /api/tasks/delete.php?id={task_id}
 * 
 * Deletes a task (soft delete by setting status to cancelled, or hard delete)
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

  $task_id = $_GET['id'] ?? null;

  if (empty($task_id)) {
    send_validation_error(['id' => 'Task ID is required']);
  }

  // Verify task exists and user has access
  $stmt = $db->prepare("
    SELECT t.id, t.project_id, t.title, t.status,
           p.workspace_id, p.name as project_name
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE t.id = ? AND wm.user_id = ?
  ");
  $stmt->execute([$task_id, $user_id]);
  $task = $stmt->fetch();

  if (!$task) {
    send_error('Task not found or access denied', 404);
  }

  // Check if task has subtasks
  $stmt = $db->prepare("SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?");
  $stmt->execute([$task_id]);
  $subtask_count = $stmt->fetch()['count'];

  if ($subtask_count > 0) {
    send_error('Cannot delete task with subtasks. Please delete or move subtasks first.', 400);
  }

  $db->beginTransaction();

  try {
    // Log activity before deletion
    $stmt = $db->prepare("
      INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, activity_type, description)
      VALUES (?, ?, ?, ?, 'task_deleted', ?)
    ");
    $description = "Task '{$task['title']}' was deleted";
    $stmt->execute([$user_id, $task['workspace_id'], $task['project_id'], $task_id, $description]);

    // Delete task (cascade will handle related records)
    $stmt = $db->prepare("DELETE FROM tasks WHERE id = ?");
    $stmt->execute([$task_id]);

    $db->commit();

    send_success(['message' => 'Task deleted successfully']);
  } catch (Exception $e) {
    $db->rollBack();
    throw $e;
  }
} catch (Exception $e) {
  error_log('Delete task endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
