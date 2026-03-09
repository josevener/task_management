<?php
/**
 * Update Task API Endpoint
 * PUT /api/tasks/update.php?id={task_id}
 * 
 * Updates an existing task
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

  $task_id = $_GET['id'] ?? null;

  if (empty($task_id)) {
    send_validation_error(['id' => 'Task ID is required']);
  }

  // Verify task exists and user has access
  $stmt = $db->prepare("
    SELECT t.id, t.project_id, t.assignee_id, t.created_by, t.status,
           p.workspace_id
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE t.id = ? AND wm.user_id = ?
  ");
  $stmt->execute([$task_id, $user_id]);
  $existing_task = $stmt->fetch();

  if (!$existing_task) {
    send_error('Task not found or access denied', 404);
  }

  $workspace_id = $existing_task['workspace_id'];
  $project_id = $existing_task['project_id'];

  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    send_error('Invalid JSON input', 400);
  }

  // Build update query dynamically based on provided fields
  $updates = [];
  $params = [];

  $allowed_fields = [
    'title', 'description', 'status', 'priority', 'assignee_id', 
    'start_date', 'due_date', 'parent_task_id'
  ];

  foreach ($allowed_fields as $field) {
    if (isset($input[$field])) {
      if ($field === 'title') {
        $value = trim($input[$field]);
        if (empty($value)) {
          send_validation_error(['title' => 'Task title cannot be empty']);
        }
        if (strlen($value) > 500) {
          send_validation_error(['title' => 'Task title must be 500 characters or less']);
        }
      } elseif ($field === 'status') {
        $valid_statuses = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
        if (!in_array($input[$field], $valid_statuses)) {
          send_validation_error(['status' => 'Invalid status']);
        }
      } elseif ($field === 'priority') {
        $valid_priorities = ['low', 'medium', 'high', 'urgent'];
        if (!in_array($input[$field], $valid_priorities)) {
          send_validation_error(['priority' => 'Invalid priority']);
        }
      } elseif ($field === 'parent_task_id' && $input[$field] === '') {
        $input[$field] = null; // Convert empty string to null
      }

      $updates[] = "{$field} = ?";
      $params[] = $input[$field] ?: null;
    }
  }

  if (empty($updates)) {
    send_error('No fields to update', 400);
  }

  // Handle tags if provided
  $tags = $input['tags'] ?? null;
  $update_tags = false;
  if ($tags !== null && is_array($tags)) {
    $update_tags = true;
  }

  $db->beginTransaction();

  try {
    // Update task
    $params[] = $task_id;
    $update_clause = implode(', ', $updates);
    $stmt = $db->prepare("
      UPDATE tasks 
      SET {$update_clause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    ");
    $stmt->execute($params);

    // Update tags if provided
    if ($update_tags) {
      // Remove existing tags
      $stmt = $db->prepare("DELETE FROM task_tag_assignments WHERE task_id = ?");
      $stmt->execute([$task_id]);

      // Add new tags
      if (!empty($tags)) {
        $stmt = $db->prepare("
          INSERT INTO task_tag_assignments (task_id, tag_id)
          VALUES (?, ?)
        ");
        foreach ($tags as $tag_id) {
          // Verify tag belongs to workspace
          $tag_check = $db->prepare("
            SELECT id FROM task_tags WHERE id = ? AND workspace_id = ?
          ");
          $tag_check->execute([$tag_id, $workspace_id]);
          if ($tag_check->fetch()) {
            $stmt->execute([$task_id, $tag_id]);
          }
        }
      }
    }

    // Log activity
    $changes = [];
    if (isset($input['status']) && $input['status'] !== $existing_task['status']) {
      $changes[] = "status changed from '{$existing_task['status']}' to '{$input['status']}'";
    }
    if (isset($input['assignee_id']) && $input['assignee_id'] != $existing_task['assignee_id']) {
      $changes[] = "assignee changed";
    }

    if (!empty($changes)) {
      $stmt = $db->prepare("
        INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, activity_type, description)
        VALUES (?, ?, ?, ?, 'task_updated', ?)
      ");
      $description = "Task updated: " . implode(', ', $changes);
      $stmt->execute([$user_id, $workspace_id, $project_id, $task_id, $description]);

      // Create notification if assignee changed
      if (isset($input['assignee_id']) && $input['assignee_id'] != $existing_task['assignee_id'] && $input['assignee_id'] != $user_id) {
        $stmt = $db->prepare("
          SELECT name FROM projects WHERE id = ?
        ");
        $stmt->execute([$project_id]);
        $project = $stmt->fetch();

        $stmt = $db->prepare("
          SELECT title FROM tasks WHERE id = ?
        ");
        $stmt->execute([$task_id]);
        $task = $stmt->fetch();

        $stmt = $db->prepare("
          INSERT INTO notifications (user_id, type, title, message, related_workspace_id, related_project_id, related_task_id)
          VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)
        ");
        $title = "Task assigned: {$task['title']}";
        $message = "You have been assigned to a task in {$project['name']}";
        $stmt->execute([$input['assignee_id'], $title, $message, $workspace_id, $project_id, $task_id]);
      }
    }

    $db->commit();

    // Get updated task
    $stmt = $db->prepare("
      SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
             t.status, t.priority, t.assignee_id, t.start_date, t.due_date,
             t.position, t.created_by, t.created_at, t.updated_at,
             assignee.first_name as assignee_first_name,
             assignee.last_name as assignee_last_name,
             assignee.email as assignee_email,
             creator.first_name as creator_first_name,
             creator.last_name as creator_last_name,
             creator.email as creator_email
      FROM tasks t
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      LEFT JOIN users creator ON creator.id = t.created_by
      WHERE t.id = ?
    ");
    $stmt->execute([$task_id]);
    $task = $stmt->fetch();

    // Get tags
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
    $db->rollBack();
    throw $e;
  }
} catch (Exception $e) {
  error_log('Update task endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
