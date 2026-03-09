<?php
/**
 * Tasks API Endpoint
 * GET /api/tasks - List tasks
 * POST /api/tasks - Create a new task
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
    // List tasks
    $project_id = $_GET['project_id'] ?? null;
    $parent_task_id = $_GET['parent_task_id'] ?? null; // For subtasks
    $status = $_GET['status'] ?? null;
    $assignee_id = $_GET['assignee_id'] ?? null;

    // Build query with filters
    $conditions = [];
    $params = [];

    if ($project_id) {
      // Verify user has access to project
      $stmt = $db->prepare("
        SELECT p.id FROM projects p
        INNER JOIN workspaces w ON w.id = p.workspace_id
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE p.id = ? AND wm.user_id = ?
      ");
      $stmt->execute([$project_id, $user_id]);
      if (!$stmt->fetch()) {
        send_error('Project access denied', 403);
      }

      $conditions[] = "t.project_id = ?";
      $params[] = $project_id;
    }

    if ($parent_task_id !== null) {
      if ($parent_task_id === '') {
        // Get only top-level tasks (no parent)
        $conditions[] = "t.parent_task_id IS NULL";
      } else {
        $conditions[] = "t.parent_task_id = ?";
        $params[] = $parent_task_id;
      }
    }

    if ($status) {
      $conditions[] = "t.status = ?";
      $params[] = $status;
    }

    if ($assignee_id) {
      $conditions[] = "t.assignee_id = ?";
      $params[] = $assignee_id;
    }

    $where_clause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

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
      {$where_clause}
      ORDER BY t.position ASC, t.created_at DESC
    ");
    $stmt->execute($params);
    $tasks = $stmt->fetchAll();

    // Get tags for each task
    foreach ($tasks as &$task) {
      $stmt = $db->prepare("
        SELECT tt.id, tt.name, tt.color
        FROM task_tags tt
        INNER JOIN task_tag_assignments tta ON tta.tag_id = tt.id
        WHERE tta.task_id = ?
      ");
      $stmt->execute([$task['id']]);
      $task['tags'] = $stmt->fetchAll();
    }

    send_success(['tasks' => $tasks]);
  } 
  elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create a new task
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
      send_error('Invalid JSON input', 400);
    }

    $project_id = $input['project_id'] ?? null;
    $parent_task_id = $input['parent_task_id'] ?? null;
    $title = trim($input['title'] ?? '');
    $description = trim($input['description'] ?? '');
    $status = $input['status'] ?? 'todo';
    $priority = $input['priority'] ?? 'medium';
    $assignee_id = $input['assignee_id'] ?? null;
    $start_date = $input['start_date'] ?? null;
    $due_date = $input['due_date'] ?? null;
    $tags = $input['tags'] ?? []; // Array of tag IDs

    // Validate input
    $errors = [];
    
    if (empty($project_id)) {
      $errors['project_id'] = 'Project ID is required';
    }

    if (empty($title)) {
      $errors['title'] = 'Task title is required';
    } elseif (strlen($title) > 500) {
      $errors['title'] = 'Task title must be 500 characters or less';
    }

    // Validate status
    $valid_statuses = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
    if (!in_array($status, $valid_statuses)) {
      $errors['status'] = 'Invalid status. Must be one of: ' . implode(', ', $valid_statuses);
    }

    // Validate priority
    $valid_priorities = ['low', 'medium', 'high', 'urgent'];
    if (!in_array($priority, $valid_priorities)) {
      $errors['priority'] = 'Invalid priority. Must be one of: ' . implode(', ', $valid_priorities);
    }

    // Validate dates
    if ($start_date && !strtotime($start_date)) {
      $errors['start_date'] = 'Invalid start date format';
    }
    if ($due_date && !strtotime($due_date)) {
      $errors['end_date'] = 'Invalid due date format';
    }

    // Verify project access
    if ($project_id) {
      $stmt = $db->prepare("
        SELECT p.id, p.workspace_id FROM projects p
        INNER JOIN workspaces w ON w.id = p.workspace_id
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE p.id = ? AND wm.user_id = ?
      ");
      $stmt->execute([$project_id, $user_id]);
      $project = $stmt->fetch();
      
      if (!$project) {
        $errors['project_id'] = 'Project access denied';
      } else {
        $workspace_id = $project['workspace_id'];
      }
    }

    // Verify parent task if provided
    if ($parent_task_id) {
      $stmt = $db->prepare("
        SELECT id FROM tasks WHERE id = ? AND project_id = ?
      ");
      $stmt->execute([$parent_task_id, $project_id]);
      if (!$stmt->fetch()) {
        $errors['parent_task_id'] = 'Parent task not found or belongs to different project';
      }
    }

    // Get max position for ordering
    $stmt = $db->prepare("
      SELECT COALESCE(MAX(position), 0) + 1 as next_position
      FROM tasks
      WHERE project_id = ? AND (parent_task_id IS NULL OR parent_task_id = ?)
    ");
    $stmt->execute([$project_id, $parent_task_id ?: null]);
    $position_result = $stmt->fetch();
    $position = $position_result['next_position'] ?? 1;

    if (!empty($errors)) {
      send_validation_error($errors);
    }

    // Create task
    $db->beginTransaction();
    
    try {
      $stmt = $db->prepare("
        INSERT INTO tasks (project_id, parent_task_id, title, description, status, priority, 
                          assignee_id, start_date, due_date, position, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ");
      $stmt->execute([
        $project_id,
        $parent_task_id ?: null,
        $title,
        $description ?: null,
        $status,
        $priority,
        $assignee_id ?: null,
        $start_date ?: null,
        $due_date ?: null,
        $position,
        $user_id
      ]);
      $task_id = $db->lastInsertId();

      // Assign tags if provided
      if (!empty($tags) && is_array($tags)) {
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

      // Add creator as follower
      $stmt = $db->prepare("
        INSERT INTO task_followers (task_id, user_id)
        VALUES (?, ?)
      ");
      $stmt->execute([$task_id, $user_id]);

      // Log activity
      $stmt = $db->prepare("
        INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, activity_type, description)
        VALUES (?, ?, ?, ?, 'task_created', ?)
      ");
      $description = "Task '{$title}' was created";
      $stmt->execute([$user_id, $workspace_id, $project_id, $task_id, $description]);

      // Create notification for assignee if assigned
      if ($assignee_id && $assignee_id != $user_id) {
        $stmt = $db->prepare("
          INSERT INTO notifications (user_id, type, title, message, related_workspace_id, related_project_id, related_task_id)
          VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)
        ");
        $title = "New task assigned: {$title}";
        // $message = "You have been assigned to a new task in {$project['name']}";
        $message = "You have been assigned to a new task";
        $stmt->execute([$assignee_id, $title, $message, $workspace_id, $project_id, $task_id]);
      }

      $db->commit();

      // Get created task
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

      send_success(['task' => $task], 201);
    } catch (Exception $e) {
      $db->rollBack();
      throw $e;
    }
  } 
  else {
    send_error('Method not allowed', 405);
  }
} catch (Exception $e) {
  error_log('Tasks endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
