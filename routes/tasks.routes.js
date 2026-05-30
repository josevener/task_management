const express = require('express');

const { query, withTransaction } = require('../config/database');
const { attachCurrentUser, requireAuth, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { buildUpdateClause, isValidDate } = require('../utils/validation');
const sseManager = require('../utils/sse-manager');

const tasksRouter = express.Router();

tasksRouter.use(attachCurrentUser, requireAuth);

async function getTaskTags(taskId) {
  return query(`
    SELECT tt.id, tt.name, tt.color
    FROM task_tags tt
    INNER JOIN task_tag_assignments tta ON tta.tag_id = tt.id
    WHERE tta.task_id = ?
  `, [taskId]);
}

async function isWorkspaceMember(workspaceId, userId) {
  const rows = await query(
    'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1',
    [workspaceId, userId]
  );

  return Boolean(rows[0]);
}

tasksRouter.get('/', asyncHandler(async (req, res) => {
  const conditions = [];
  const params = [];

  if (req.query.project_id) {
    const projectRows = await query(`
      SELECT p.id
      FROM projects p
      INNER JOIN workspaces w ON w.id = p.workspace_id
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE p.id = ? AND wm.user_id = ?
      LIMIT 1
    `, [req.query.project_id, req.currentUser.id]);

    if (!projectRows[0]) {
      return sendError(res, 'Project access denied', 403);
    }

    conditions.push('t.project_id = ?');
    params.push(req.query.project_id);
  }
  else if (req.query.workspace_id) {
    const accessRows = await query(`
      SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
    `, [req.query.workspace_id, req.currentUser.id]);

    if (!accessRows[0]) {
      return sendError(res, 'Workspace access denied', 403);
    }

    conditions.push(`EXISTS (
      SELECT 1 FROM projects p3 
      WHERE p3.id = t.project_id AND p3.workspace_id = ?
    )`);
    params.push(req.query.workspace_id);
  }
  else {
    conditions.push(`EXISTS (
      SELECT 1
      FROM projects p2
      INNER JOIN workspaces w2 ON w2.id = p2.workspace_id
      INNER JOIN workspace_members wm2 ON wm2.workspace_id = w2.id
      WHERE p2.id = t.project_id AND wm2.user_id = ?
    )`);
    params.push(req.currentUser.id);
  }

  if (Object.prototype.hasOwnProperty.call(req.query, 'parent_task_id')) {
    if (req.query.parent_task_id === '') {
      conditions.push('t.parent_task_id IS NULL');
    }
    else {
      conditions.push('t.parent_task_id = ?');
      params.push(req.query.parent_task_id);
    }
  }

  if (req.query.status) {
    conditions.push('t.status = ?');
    params.push(req.query.status);
  }

  if (req.query.assignee_id) {
    conditions.push('t.assignee_id = ?');
    params.push(req.query.assignee_id);
  }

  const tasks = await query(`
    SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
           t.status, t.priority, t.assignee_id, t.assigned_by, t.start_date, t.due_date,
           t.position, t.created_by, t.created_at, t.updated_at,
           assignee.first_name AS assignee_first_name,
           assignee.last_name AS assignee_last_name,
           assignee.email AS assignee_email,
           creator.first_name AS creator_first_name,
           creator.last_name AS creator_last_name,
           creator.email AS creator_email,
           assigner.first_name AS assigner_first_name,
           assigner.last_name AS assigner_last_name,
           p.name AS project_name
    FROM tasks t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assigner ON assigner.id = t.assigned_by
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.position ASC, t.created_at DESC
  `, params);

  for (const task of tasks) {
    task.tags = await getTaskTags(task.id);
  }

  return sendSuccess(res, { tasks });
}));

tasksRouter.get('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
           t.status, t.priority, t.assignee_id, t.assigned_by, t.start_date, t.due_date,
           t.position, t.created_by, t.created_at, t.updated_at,
           assignee.first_name AS assignee_first_name,
           assignee.last_name AS assignee_last_name,
           assignee.email AS assignee_email,
           creator.first_name AS creator_first_name,
           creator.last_name AS creator_last_name,
           creator.email AS creator_email,
           p.name AS project_name,
           assigner.first_name AS assigner_first_name,
           assigner.last_name AS assigner_last_name
    FROM tasks t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assigner ON assigner.id = t.assigned_by
    LEFT JOIN projects p ON p.id = t.project_id
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE t.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!rows[0]) {
    return sendError(res, 'Task not found or access denied', 404);
  }

  rows[0].tags = await getTaskTags(req.params.id);
  return sendSuccess(res, { task: rows[0] });
}));

tasksRouter.post('/', asyncHandler(async (req, res) => {
  const project_id = req.body.project_id;
  const parent_task_id = req.body.parent_task_id || null;
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const status = req.body.status || 'todo';
  const priority = req.body.priority || 'medium';
  const assignee_id = req.body.assignee_id || null;
  const start_date = req.body.start_date || null;
  const due_date = req.body.due_date || null;
  const tags = Array.isArray(req.body.tags) ? req.body.tags : [];
  const errors = {};

  if (!project_id) {
    errors.project_id = 'Project ID is required';
  }
  if (!title) {
    errors.title = 'Task title is required';
  }
  else if (title.length > 500) {
    errors.title = 'Task title must be 500 characters or less';
  }
  if (!['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(status)) {
    errors.status = 'Invalid status. Must be one of: todo, in_progress, review, done, cancelled';
  }
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    errors.priority = 'Invalid priority. Must be one of: low, medium, high, urgent';
  }
  if (!isValidDate(start_date)) {
    errors.start_date = 'Invalid start date format';
  }
  if (!isValidDate(due_date)) {
    errors.due_date = 'Invalid due date format';
  }

  const projectRows = project_id ? await query(`
    SELECT p.id, p.workspace_id, p.name
    FROM projects p
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE p.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [project_id, req.currentUser.id]) : [];

  const project = projectRows[0];
  if (project_id) {
    if (!project) {
      errors.project_id = 'Project access denied';
    }
    else {
      const canCreate = await checkPermission(project.workspace_id, req.currentUser.id, 'tasks:create');
      if (!canCreate) {
        errors.project_id = 'You do not have permission to create tasks in this workspace';
      }
    }
  }

  if (parent_task_id) {
    const parentRows = await query(`
      SELECT id FROM tasks WHERE id = ? AND project_id = ?
    `, [parent_task_id, project_id]);

    if (!parentRows[0]) {
      errors.parent_task_id = 'Parent task not found or belongs to different project';
    }
  }

  if (assignee_id && project) {
    const assigneeIsMember = await isWorkspaceMember(project.workspace_id, assignee_id);
    if (!assigneeIsMember) {
      errors.assignee_id = 'Assignee must be a member of this workspace';
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const task = await withTransaction(async (connection) => {
    const [positionRows] = await connection.execute(`
      SELECT COALESCE(MAX(position), 0) + 1 AS next_position
      FROM tasks
      WHERE project_id = ? AND (parent_task_id <=> ?)
    `, [project_id, parent_task_id]);

    const position = positionRows[0].next_position || 1;

    const [taskResult] = await connection.execute(`
      INSERT INTO tasks (project_id, parent_task_id, title, description, status, priority, assignee_id, assigned_by, start_date, due_date, position, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project_id,
      parent_task_id,
      title,
      description || null,
      status,
      priority,
      assignee_id,
      assignee_id ? req.currentUser.id : null,
      start_date || null,
      due_date || null,
      position,
      req.currentUser.id,
    ]);

    for (const tagId of tags) {
      const [tagRows] = await connection.execute(`
        SELECT id FROM task_tags WHERE id = ? AND workspace_id = ?
      `, [tagId, project.workspace_id]);

      if (tagRows[0]) {
        await connection.execute(`
          INSERT INTO task_tag_assignments (task_id, tag_id)
          VALUES (?, ?)
        `, [taskResult.insertId, tagId]);
      }
    }

    await connection.execute(`
      INSERT INTO task_followers (task_id, user_id)
      VALUES (?, ?)
    `, [taskResult.insertId, req.currentUser.id]);

    await connection.execute(`
      INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, activity_type, description)
      VALUES (?, ?, ?, ?, 'task_created', ?)
    `, [req.currentUser.id, project.workspace_id, project_id, taskResult.insertId, `Task '${title}' was created`]);

    if (assignee_id && Number(assignee_id) !== Number(req.currentUser.id)) {
      await connection.execute(`
        INSERT INTO notifications (user_id, type, title, message, related_workspace_id, related_project_id, related_task_id)
        VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)
      `, [assignee_id, `New task assigned: ${title}`, 'You have been assigned to a new task', project.workspace_id, project_id, taskResult.insertId]);

      // Get the newly created notification to broadcast it
      const [newNotif] = await connection.execute(`
        SELECT n.*, w.name as workspace_name, p.name as project_name, ? as task_title
        FROM notifications n
        LEFT JOIN workspaces w ON n.related_workspace_id = w.id
        LEFT JOIN projects p ON n.related_project_id = p.id
        WHERE n.id = LAST_INSERT_ID()
      `, [title]);

      if (newNotif[0]) {
        sseManager.broadcastToUser(assignee_id, 'new_notification', newNotif[0]);
      }
    }

    const [taskRows] = await connection.execute(`
      SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
             t.status, t.priority, t.assignee_id, t.assigned_by, t.start_date, t.due_date,
             t.position, t.created_by, t.created_at, t.updated_at,
             assignee.first_name AS assignee_first_name,
             assignee.last_name AS assignee_last_name,
             assignee.email AS assignee_email,
             creator.first_name AS creator_first_name,
             creator.last_name AS creator_last_name,
             creator.email AS creator_email,
             assigner.first_name AS assigner_first_name,
             assigner.last_name AS assigner_last_name
      FROM tasks t
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      LEFT JOIN users creator ON creator.id = t.created_by
      LEFT JOIN users assigner ON assigner.id = t.assigned_by
      WHERE t.id = ?
    `, [taskResult.insertId]);

    return taskRows[0];
  });

  task.tags = await getTaskTags(task.id);
  return sendSuccess(res, { task }, 201);
}));

tasksRouter.patch('/:id', asyncHandler(async (req, res) => {
  const taskRows = await query(`
    SELECT t.id, t.project_id, t.assignee_id, t.created_by, t.status, p.workspace_id
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE t.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  const existingTask = taskRows[0];
  if (!existingTask) {
    return sendError(res, 'Task not found or access denied', 404);
  }

  const canEdit = await checkPermission(existingTask.workspace_id, req.currentUser.id, 'tasks:edit');
  if (!canEdit && Number(existingTask.assignee_id) !== Number(req.currentUser.id)) {
    return sendError(res, 'You do not have permission to edit this task', 403);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
    const title = String(req.body.title || '').trim();
    if (!title) {
      return sendValidationError(res, { title: 'Task title cannot be empty' });
    }
    if (title.length > 500) {
      return sendValidationError(res, { title: 'Task title must be 500 characters or less' });
    }
    req.body.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(req.body.status)) {
    return sendValidationError(res, { status: 'Invalid status' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'priority') && !['low', 'medium', 'high', 'urgent'].includes(req.body.priority)) {
    return sendValidationError(res, { priority: 'Invalid priority' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'start_date') && !isValidDate(req.body.start_date)) {
    return sendValidationError(res, { start_date: 'Invalid start date format' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'due_date') && !isValidDate(req.body.due_date)) {
    return sendValidationError(res, { due_date: 'Invalid due date format' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id') && req.body.assignee_id) {
    const assigneeIsMember = await isWorkspaceMember(existingTask.workspace_id, req.body.assignee_id);
    if (!assigneeIsMember) {
      return sendValidationError(res, { assignee_id: 'Assignee must be a member of this workspace' });
    }
  }

  const { updates, params } = buildUpdateClause(req.body, ['title', 'description', 'status', 'priority', 'assignee_id', 'start_date', 'due_date', 'parent_task_id', 'position']);
  const shouldUpdateTags = Array.isArray(req.body.tags);

  if (updates.length === 0 && !shouldUpdateTags) {
    return sendError(res, 'No fields to update', 400);
  }

  // Handle explicit assignee updates explicitly to update assigned_by
  if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id')) {
    updates.push('assigned_by = ?');
    params.push(req.body.assignee_id ? req.currentUser.id : null);
  }

  await withTransaction(async (connection) => {
    if (updates.length > 0) {
      await connection.execute(`
        UPDATE tasks
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [...params, req.params.id]);
    }

    if (shouldUpdateTags) {
      await connection.execute('DELETE FROM task_tag_assignments WHERE task_id = ?', [req.params.id]);

      for (const tagId of req.body.tags) {
        const [tagRows] = await connection.execute(`
          SELECT id FROM task_tags WHERE id = ? AND workspace_id = ?
        `, [tagId, existingTask.workspace_id]);

        if (tagRows[0]) {
          await connection.execute(`
            INSERT INTO task_tag_assignments (task_id, tag_id)
            VALUES (?, ?)
          `, [req.params.id, tagId]);
        }
      }
    }

    const changes = [];
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && req.body.status !== existingTask.status) {
      changes.push(`status changed from '${existingTask.status}' to '${req.body.status}'`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id') && Number(req.body.assignee_id || 0) !== Number(existingTask.assignee_id || 0)) {
      changes.push('assignee changed');
    }

    if (changes.length > 0) {
      await connection.execute(`
        INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, activity_type, description)
        VALUES (?, ?, ?, ?, 'task_updated', ?)
      `, [req.currentUser.id, existingTask.workspace_id, existingTask.project_id, req.params.id, `Task updated: ${changes.join(', ')}`]);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignee_id') &&
      Number(req.body.assignee_id || 0) !== Number(existingTask.assignee_id || 0) &&
      Number(req.body.assignee_id || 0) !== Number(req.currentUser.id)) {
      const [projectRows] = await connection.execute('SELECT name FROM projects WHERE id = ?', [existingTask.project_id]);
      const [taskTitleRows] = await connection.execute('SELECT title FROM tasks WHERE id = ?', [req.params.id]);

      await connection.execute(`
        INSERT INTO notifications (user_id, type, title, message, related_workspace_id, related_project_id, related_task_id)
        VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)
      `, [
        req.body.assignee_id,
        `Task assigned: ${taskTitleRows[0].title}`,
        `You have been assigned to a task in ${projectRows[0].name}`,
        existingTask.workspace_id,
        existingTask.project_id,
        req.params.id,
      ]);

      const [newNotif] = await connection.execute(`
        SELECT n.*, w.name as workspace_name, p.name as project_name, ? as task_title
        FROM notifications n
        LEFT JOIN workspaces w ON n.related_workspace_id = w.id
        LEFT JOIN projects p ON n.related_project_id = p.id
        WHERE n.id = LAST_INSERT_ID()
      `, [taskTitleRows[0].title]);

      if (newNotif[0]) {
        sseManager.broadcastToUser(req.body.assignee_id, 'new_notification', newNotif[0]);
      }
    }

    // New notification for status change
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') &&
      req.body.status !== existingTask.status &&
      existingTask.assignee_id &&
      Number(existingTask.assignee_id) !== Number(req.currentUser.id)) {
      const [projectRows] = await connection.execute('SELECT name FROM projects WHERE id = ?', [existingTask.project_id]);
      const [taskTitleRows] = await connection.execute('SELECT title FROM tasks WHERE id = ?', [req.params.id]);

      await connection.execute(`
        INSERT INTO notifications (user_id, type, title, message, related_workspace_id, related_project_id, related_task_id)
        VALUES (?, 'task_status_changed', ?, ?, ?, ?, ?)
      `, [
        existingTask.assignee_id,
        `Task status changed: ${taskTitleRows[0].title}`,
        `The status is now '${req.body.status}'`,
        existingTask.workspace_id,
        existingTask.project_id,
        req.params.id,
      ]);

      const [newNotif] = await connection.execute(`
        SELECT n.*, w.name as workspace_name, p.name as project_name, ? as task_title
        FROM notifications n
        LEFT JOIN workspaces w ON n.related_workspace_id = w.id
        LEFT JOIN projects p ON n.related_project_id = p.id
        WHERE n.id = LAST_INSERT_ID()
      `, [taskTitleRows[0].title]);

      if (newNotif[0]) {
        sseManager.broadcastToUser(existingTask.assignee_id, 'new_notification', newNotif[0]);
      }
    }
  });

  const rows = await query(`
    SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
           t.status, t.priority, t.assignee_id, t.assigned_by, t.start_date, t.due_date,
           t.position, t.created_by, t.created_at, t.updated_at,
           assignee.first_name AS assignee_first_name,
           assignee.last_name AS assignee_last_name,
           assignee.email AS assignee_email,
           creator.first_name AS creator_first_name,
           creator.last_name AS creator_last_name,
           creator.email AS creator_email,
           assigner.first_name AS assigner_first_name,
           assigner.last_name AS assigner_last_name
    FROM tasks t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assigner ON assigner.id = t.assigned_by
    WHERE t.id = ?
  `, [req.params.id]);

  rows[0].tags = await getTaskTags(req.params.id);
  return sendSuccess(res, { task: rows[0] });
}));

tasksRouter.delete('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT t.id, t.project_id, t.title, p.workspace_id
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE t.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  const task = rows[0];
  if (!task) {
    return sendError(res, 'Task not found or access denied', 404);
  }

  const canDelete = await checkPermission(task.workspace_id, req.currentUser.id, 'tasks:delete');
  if (!canDelete) {
    return sendError(res, 'You do not have permission to delete this task', 403);
  }

  const subtaskRows = await query('SELECT COUNT(*) AS count FROM tasks WHERE parent_task_id = ?', [req.params.id]);
  if (Number(subtaskRows[0].count) > 0) {
    return sendError(res, 'Cannot delete task with subtasks. Please delete or move subtasks first.', 400);
  }

  await withTransaction(async (connection) => {
    await connection.execute(`
      INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, activity_type, description)
      VALUES (?, ?, ?, ?, 'task_deleted', ?)
    `, [req.currentUser.id, task.workspace_id, task.project_id, req.params.id, `Task '${task.title}' was deleted`]);

    await connection.execute('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  });

  return sendSuccess(res, { message: 'Task deleted successfully' });
}));

module.exports = { tasksRouter };
