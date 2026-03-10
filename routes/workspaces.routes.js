const express = require('express');
const bcrypt = require('bcryptjs');

const { query, withTransaction } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { buildUpdateClause } = require('../utils/validation');

const workspacesRouter = express.Router();

workspacesRouter.use(attachCurrentUser, requireAuth);

workspacesRouter.get('/', asyncHandler(async (req, res) => {
  const params = [req.currentUser.id];
  let sql = `
    SELECT w.id, w.organization_id, w.name, w.slug, w.description,
           w.logo_url, w.color_theme, w.created_at, w.updated_at,
           o.name AS organization_name
    FROM workspaces w
    INNER JOIN organizations o ON o.id = w.organization_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ? AND w.is_active = TRUE
  `;

  if (req.query.organization_id) {
    sql += ' AND w.organization_id = ?';
    params.push(req.query.organization_id);
  }

  sql += ' ORDER BY w.created_at DESC';
  const workspaces = await query(sql, params);
  return sendSuccess(res, { workspaces });
}));

workspacesRouter.get('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT w.id, w.organization_id, w.name, w.slug, w.description,
           w.logo_url, w.color_theme, w.created_at, w.updated_at,
           o.name AS organization_name, wm.role AS user_role
    FROM workspaces w
    INNER JOIN organizations o ON o.id = w.organization_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ? AND w.is_active = TRUE
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!rows[0]) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  return sendSuccess(res, { workspace: rows[0] });
}));

workspacesRouter.post('/', asyncHandler(async (req, res) => {
  const organization_id = req.body.organization_id;
  const name = String(req.body.name || '').trim();
  const slug = createSlug(req.body.slug || name);
  const description = String(req.body.description || '').trim();
  const color_theme = req.body.color_theme || 'blue';
  const errors = {};

  if (!organization_id) {
    errors.organization_id = 'Organization ID is required';
  }
  if (!name) {
    errors.name = 'Workspace name is required';
  } else if (name.length > 255) {
    errors.name = 'Workspace name must be 255 characters or less';
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
  }

  const orgAccess = organization_id ? await query(`
    SELECT o.id
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE o.id = ? AND wm.user_id = ? AND o.is_active = TRUE
    LIMIT 1
  `, [organization_id, req.currentUser.id]) : [];

  if (organization_id && !orgAccess[0]) {
    errors.organization_id = 'Organization not found or access denied';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const existing = await query(`
    SELECT id FROM workspaces WHERE organization_id = ? AND slug = ?
  `, [organization_id, slug]);

  if (existing.length > 0) {
    return sendValidationError(res, { slug: 'This slug is already taken in this organization' });
  }

  const workspace = await withTransaction(async (connection) => {
    const [insertResult] = await connection.execute(`
      INSERT INTO workspaces (organization_id, name, slug, description, color_theme)
      VALUES (?, ?, ?, ?, ?)
    `, [organization_id, name, slug, description || null, color_theme]);

    await connection.execute(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'admin')
    `, [insertResult.insertId, req.currentUser.id]);

    const [rows] = await connection.execute(`
      SELECT w.id, w.organization_id, w.name, w.slug, w.description,
             w.logo_url, w.color_theme, w.created_at, w.updated_at,
             o.name AS organization_name
      FROM workspaces w
      INNER JOIN organizations o ON o.id = w.organization_id
      WHERE w.id = ?
    `, [insertResult.insertId]);

    return rows[0];
  });

  return sendSuccess(res, { workspace }, 201);
}));

workspacesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const permissionRows = await query(`
    SELECT w.id, w.organization_id
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ? AND wm.role IN ('admin', 'manager')
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  const existingWorkspace = permissionRows[0];
  if (!existingWorkspace) {
    return sendError(res, 'Workspace not found or you do not have permission to edit it', 404);
  }

  const input = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(input, 'name') && !String(input.name || '').trim()) {
    return sendValidationError(res, { name: 'Workspace name cannot be empty' });
  }

  if (Object.prototype.hasOwnProperty.call(input, 'slug')) {
    input.slug = createSlug(input.slug);
    if (!input.slug) {
      return sendValidationError(res, { slug: 'Slug cannot be empty' });
    }

    const slugRows = await query(`
      SELECT id FROM workspaces
      WHERE slug = ? AND organization_id = ? AND id != ?
    `, [input.slug, existingWorkspace.organization_id, req.params.id]);

    if (slugRows.length > 0) {
      return sendValidationError(res, { slug: 'Slug must be unique within the organization' });
    }
  }

  const { updates, params } = buildUpdateClause(input, ['name', 'slug', 'description', 'color_theme', 'logo_url']);
  if (updates.length === 0) {
    return sendError(res, 'No fields to update', 400);
  }

  await query(`
    UPDATE workspaces
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...params, req.params.id]);

  const rows = await query('SELECT * FROM workspaces WHERE id = ?', [req.params.id]);
  return sendSuccess(res, { workspace: rows[0] });
}));

workspacesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const permissionRows = await query(`
    SELECT w.id
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ? AND wm.role = 'admin'
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!permissionRows[0]) {
    return sendError(res, 'Workspace not found or you do not have permission to delete it', 404);
  }

  await query('DELETE FROM workspaces WHERE id = ?', [req.params.id]);
  return sendSuccess(res, { message: 'Workspace deleted successfully' });
}));

workspacesRouter.get('/:workspaceId/members', asyncHandler(async (req, res) => {
  const accessRows = await query(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `, [req.params.workspaceId, req.currentUser.id]);

  if (!accessRows[0]) {
    return sendError(res, 'Workspace access denied', 403);
  }

  const members = await query(`
    SELECT wm.id AS membership_id, wm.role, wm.created_at,
           u.id AS user_id, u.first_name, u.last_name, u.email
    FROM workspace_members wm
    INNER JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ?
    ORDER BY wm.created_at ASC
  `, [req.params.workspaceId]);

  return sendSuccess(res, { members });
}));

workspacesRouter.post('/:workspaceId/members', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const role = req.body.role || 'member';
  const action = req.body.action || 'invite';
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }
  if (!['admin', 'manager', 'member', 'guest'].includes(role)) {
    errors.role = 'Invalid role. Must be one of: admin, manager, member, guest';
  }

  const permissionRows = await query(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `, [req.params.workspaceId, req.currentUser.id]);

  if (!permissionRows[0] || !['admin', 'manager'].includes(permissionRows[0].role)) {
    errors.workspace_id = 'You do not have permission to add members to this workspace';
  }

  if (action === 'create') {
    if (!String(req.body.first_name || '').trim()) {
      errors.first_name = 'First name is required';
    }
    if (!String(req.body.last_name || '').trim()) {
      errors.last_name = 'Last name is required';
    }
    if (!String(req.body.password || '')) {
      errors.password = 'Password is required';
    } else if (String(req.body.password).length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const member = await withTransaction(async (connection) => {
    let user_id_to_add;

    if (action === 'create') {
      const [existingUsers] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUsers[0]) {
        const error = new Error('validation');
        error.statusCode = 422;
        error.payload = { email: 'User with this email already exists in the system. Use the Invite method instead.' };
        throw error;
      }

      const password_hash = await bcrypt.hash(String(req.body.password), 10);
      const [userResult] = await connection.execute(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES (?, ?, ?, ?)
      `, [email, password_hash, String(req.body.first_name).trim(), String(req.body.last_name).trim()]);
      user_id_to_add = userResult.insertId;
    } else {
      const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (!users[0]) {
        const error = new Error('No user found with that email address. They must register first.');
        error.statusCode = 400;
        throw error;
      }
      user_id_to_add = users[0].id;
    }

    const [existingMemberships] = await connection.execute(`
      SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?
    `, [req.params.workspaceId, user_id_to_add]);

    if (existingMemberships[0]) {
      const error = new Error('User is already a member of this workspace');
      error.statusCode = 409;
      throw error;
    }

    const [membershipResult] = await connection.execute(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, ?)
    `, [req.params.workspaceId, user_id_to_add, role]);

    const [rows] = await connection.execute(`
      SELECT wm.id AS membership_id, wm.role, wm.created_at,
             u.id AS user_id, u.first_name, u.last_name, u.email
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      WHERE wm.id = ?
    `, [membershipResult.insertId]);

    return rows[0];
  }).catch((error) => {
    if (error.payload) {
      return sendValidationError(res, error.payload);
    }
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    throw error;
  });

  if (res.headersSent) {
    return undefined;
  }

  return sendSuccess(res, { member }, 201);
}));

workspacesRouter.delete('/members/:membershipId', asyncHandler(async (req, res) => {
  const targetRows = await query(`
    SELECT workspace_id, user_id, role FROM workspace_members WHERE id = ?
  `, [req.params.membershipId]);

  const targetMember = targetRows[0];
  if (!targetMember) {
    return sendError(res, 'Membership not found', 404);
  }

  if (Number(targetMember.user_id) !== Number(req.currentUser.id)) {
    const permissionRows = await query(`
      SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
    `, [targetMember.workspace_id, req.currentUser.id]);

    if (!permissionRows[0] || !['admin', 'manager'].includes(permissionRows[0].role)) {
      return sendError(res, 'You do not have permission to remove members from this workspace', 403);
    }
  }

  if (targetMember.role === 'admin') {
    const adminRows = await query(`
      SELECT COUNT(*) AS admin_count
      FROM workspace_members
      WHERE workspace_id = ? AND role = 'admin'
    `, [targetMember.workspace_id]);

    if (Number(adminRows[0].admin_count) <= 1) {
      return sendError(res, 'Cannot remove the last administrator. Promote someone else first.', 400);
    }
  }

  await query('DELETE FROM workspace_members WHERE id = ?', [req.params.membershipId]);
  return sendSuccess(res, { message: 'Member removed successfully' });
}));

module.exports = { workspacesRouter };
