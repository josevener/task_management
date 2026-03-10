const express = require('express');

const { query, withTransaction } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { buildUpdateClause, isValidDate } = require('../utils/validation');

const projectsRouter = express.Router();

projectsRouter.use(attachCurrentUser, requireAuth);

projectsRouter.get('/', asyncHandler(async (req, res) => {
  if (req.query.workspace_id) {
    const accessRows = await query(`
      SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
    `, [req.query.workspace_id, req.currentUser.id]);

    if (!accessRows[0]) {
      return sendError(res, 'Workspace access denied', 403);
    }

    const projects = await query(`
      SELECT p.id, p.workspace_id, p.name, p.description, p.status,
             p.owner_id, p.start_date, p.end_date, p.progress_percentage,
             p.health_status, p.is_template, p.created_at, p.updated_at,
             u.first_name AS owner_first_name, u.last_name AS owner_last_name,
             u.email AS owner_email
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.workspace_id = ?
      ORDER BY p.created_at DESC
    `, [req.query.workspace_id]);

    return sendSuccess(res, { projects });
  }

  const projects = await query(`
    SELECT p.id, p.workspace_id, p.name, p.description, p.status,
           p.owner_id, p.start_date, p.end_date, p.progress_percentage,
           p.health_status, p.is_template, p.created_at, p.updated_at,
           u.first_name AS owner_first_name, u.last_name AS owner_last_name,
           u.email AS owner_email, w.name AS workspace_name
    FROM projects p
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE wm.user_id = ?
    ORDER BY p.created_at DESC
  `, [req.currentUser.id]);

  return sendSuccess(res, { projects });
}));

projectsRouter.get('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT p.id, p.workspace_id, p.name, p.description, p.status,
           p.owner_id, p.start_date, p.end_date, p.progress_percentage,
           p.health_status, p.is_template, p.created_at, p.updated_at,
           u.first_name AS owner_first_name, u.last_name AS owner_last_name,
           u.email AS owner_email, w.name AS workspace_name
    FROM projects p
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE p.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!rows[0]) {
    return sendError(res, 'Project not found or access denied', 404);
  }

  return sendSuccess(res, { project: rows[0] });
}));

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const workspace_id = req.body.workspace_id;
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const status = req.body.status || 'active';
  const start_date = req.body.start_date || null;
  const end_date = req.body.end_date || null;
  const is_template = Boolean(req.body.is_template);
  const errors = {};

  if (!workspace_id) {
    errors.workspace_id = 'Workspace ID is required';
  }
  if (!name) {
    errors.name = 'Project name is required';
  } else if (name.length > 255) {
    errors.name = 'Project name must be 255 characters or less';
  }
  if (!['active', 'on_hold', 'completed', 'archived'].includes(status)) {
    errors.status = 'Invalid status. Must be one of: active, on_hold, completed, archived';
  }
  if (!isValidDate(start_date)) {
    errors.start_date = 'Invalid start date format';
  }
  if (!isValidDate(end_date)) {
    errors.end_date = 'Invalid end date format';
  }
  if (start_date && end_date && Date.parse(start_date) > Date.parse(end_date)) {
    errors.end_date = 'End date must be after start date';
  }

  const memberRows = workspace_id ? await query(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `, [workspace_id, req.currentUser.id]) : [];

  if (workspace_id && !memberRows[0]) {
    errors.workspace_id = 'Workspace access denied';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const project = await withTransaction(async (connection) => {
    const [projectResult] = await connection.execute(`
      INSERT INTO projects (workspace_id, name, description, status, owner_id, start_date, end_date, is_template)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      workspace_id,
      name,
      description || null,
      status,
      req.currentUser.id,
      start_date || null,
      end_date || null,
      is_template ? 1 : 0,
    ]);

    await connection.execute(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (?, ?, 'owner')
    `, [projectResult.insertId, req.currentUser.id]);

    await connection.execute(`
      INSERT INTO activity_logs (user_id, workspace_id, project_id, activity_type, description)
      VALUES (?, ?, ?, 'project_created', ?)
    `, [req.currentUser.id, workspace_id, projectResult.insertId, `Project '${name}' was created`]);

    const [rows] = await connection.execute(`
      SELECT p.id, p.workspace_id, p.name, p.description, p.status,
             p.owner_id, p.start_date, p.end_date, p.progress_percentage,
             p.health_status, p.is_template, p.created_at, p.updated_at,
             u.first_name AS owner_first_name, u.last_name AS owner_last_name,
             u.email AS owner_email
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = ?
    `, [projectResult.insertId]);

    return rows[0];
  });

  return sendSuccess(res, { project }, 201);
}));

projectsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT p.id, p.workspace_id, pm.role AS project_role, wm.role AS workspace_role
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
    WHERE p.id = ?
    LIMIT 1
  `, [req.currentUser.id, req.currentUser.id, req.params.id]);

  const existingProject = rows[0];
  if (!existingProject) {
    return sendError(res, 'Project not found or access denied', 404);
  }

  const canEdit = existingProject.project_role === 'owner' || ['admin', 'manager'].includes(existingProject.workspace_role);
  if (!canEdit) {
    return sendError(res, 'You do not have permission to edit this project', 403);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'name') && !String(req.body.name || '').trim()) {
    return sendValidationError(res, { name: 'Project name cannot be empty' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !['active', 'on_hold', 'completed', 'archived'].includes(req.body.status)) {
    return sendValidationError(res, { status: 'Invalid status' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'health_status') && !['on_track', 'at_risk', 'off_track', 'not_set'].includes(req.body.health_status)) {
    return sendValidationError(res, { health_status: 'Invalid health status' });
  }

  const { updates, params } = buildUpdateClause(req.body, ['name', 'description', 'status', 'start_date', 'end_date', 'progress_percentage', 'health_status']);
  if (updates.length === 0) {
    return sendError(res, 'No fields to update', 400);
  }

  await withTransaction(async (connection) => {
    await connection.execute(`
      UPDATE projects
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [...params, req.params.id]);

    await connection.execute(`
      INSERT INTO activity_logs (user_id, workspace_id, project_id, activity_type, description)
      VALUES (?, ?, ?, 'project_updated', 'Project details were updated')
    `, [req.currentUser.id, existingProject.workspace_id, req.params.id]);
  });

  const projectRows = await query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  return sendSuccess(res, { project: projectRows[0] });
}));

projectsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT p.id, p.workspace_id, pm.role AS project_role, wm.role AS workspace_role
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
    WHERE p.id = ?
    LIMIT 1
  `, [req.currentUser.id, req.currentUser.id, req.params.id]);

  const existingProject = rows[0];
  if (!existingProject) {
    return sendError(res, 'Project not found or access denied', 404);
  }

  const canDelete = existingProject.project_role === 'owner' || existingProject.workspace_role === 'admin';
  if (!canDelete) {
    return sendError(res, 'You do not have permission to delete this project', 403);
  }

  await withTransaction(async (connection) => {
    await connection.execute(`
      INSERT INTO activity_logs (user_id, workspace_id, activity_type, description)
      VALUES (?, ?, 'project_deleted', 'A project was deleted')
    `, [req.currentUser.id, existingProject.workspace_id]);

    await connection.execute('DELETE FROM projects WHERE id = ?', [req.params.id]);
  });

  return sendSuccess(res, { message: 'Project deleted successfully' });
}));

projectsRouter.get('/:projectId/members', asyncHandler(async (req, res) => {
  const accessRows = await query(`
    SELECT p.workspace_id
    FROM projects p
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.projectId, req.currentUser.id]);

  if (!accessRows[0]) {
    return sendError(res, 'Project access denied or project not found', 403);
  }

  const members = await query(`
    SELECT u.id, u.first_name, u.last_name, u.email, wm.role AS workspace_role
    FROM workspace_members wm
    INNER JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ?
    ORDER BY u.first_name ASC, u.last_name ASC
  `, [accessRows[0].workspace_id]);

  return sendSuccess(res, { members });
}));

module.exports = { projectsRouter };
