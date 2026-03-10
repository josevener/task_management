const express = require('express');

const { query, withTransaction } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { buildUpdateClause } = require('../utils/validation');

const organizationsRouter = express.Router();

organizationsRouter.use(attachCurrentUser, requireAuth);

organizationsRouter.get('/', asyncHandler(async (req, res) => {
  const organizations = await query(`
    SELECT DISTINCT o.id, o.name, o.slug, o.logo_url, o.subscription_tier, o.created_at, o.updated_at
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ? AND o.is_active = TRUE
    ORDER BY o.created_at DESC
  `, [req.currentUser.id]);

  return sendSuccess(res, { organizations });
}));

organizationsRouter.get('/:id', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT DISTINCT o.id, o.name, o.slug, o.logo_url, o.subscription_tier, o.created_at, o.updated_at
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE o.id = ? AND wm.user_id = ? AND o.is_active = TRUE
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!rows[0]) {
    return sendError(res, 'Organization not found or access denied', 404);
  }

  return sendSuccess(res, { organization: rows[0] });
}));

organizationsRouter.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const slug = createSlug(req.body.slug || name);
  const errors = {};

  if (!name) {
    errors.name = 'Organization name is required';
  } else if (name.length > 255) {
    errors.name = 'Organization name must be 255 characters or less';
  }

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const existing = await query('SELECT id FROM organizations WHERE slug = ?', [slug]);
  if (existing.length > 0) {
    return sendValidationError(res, { slug: 'This slug is already taken' });
  }

  const organization = await withTransaction(async (connection) => {
    const [organizationResult] = await connection.execute(`
      INSERT INTO organizations (name, slug, subscription_tier)
      VALUES (?, ?, ?)
    `, [name, slug, req.body.subscription_tier || 'free']);

    const workspace_name = `${name} Workspace`;
    const workspace_slug = `${slug}-workspace`;

    const [workspaceResult] = await connection.execute(`
      INSERT INTO workspaces (organization_id, name, slug)
      VALUES (?, ?, ?)
    `, [organizationResult.insertId, workspace_name, workspace_slug]);

    await connection.execute(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'admin')
    `, [workspaceResult.insertId, req.currentUser.id]);

    const [rows] = await connection.execute(`
      SELECT id, name, slug, logo_url, subscription_tier, created_at, updated_at
      FROM organizations
      WHERE id = ?
    `, [organizationResult.insertId]);

    return rows[0];
  });

  return sendSuccess(res, { organization }, 201);
}));

organizationsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const adminRows = await query(`
    SELECT o.id
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE o.id = ? AND wm.user_id = ? AND wm.role = 'admin'
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!adminRows[0]) {
    return sendError(res, 'Organization not found or you do not have permission to edit it', 404);
  }

  const input = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(input, 'name') && !String(input.name || '').trim()) {
    return sendValidationError(res, { name: 'Organization name cannot be empty' });
  }

  if (Object.prototype.hasOwnProperty.call(input, 'slug')) {
    input.slug = createSlug(input.slug);
    if (!input.slug) {
      return sendValidationError(res, { slug: 'Slug cannot be empty' });
    }

    const slugRows = await query('SELECT id FROM organizations WHERE slug = ? AND id != ?', [input.slug, req.params.id]);
    if (slugRows.length > 0) {
      return sendValidationError(res, { slug: 'Slug must be unique' });
    }
  }

  const { updates, params } = buildUpdateClause(input, ['name', 'slug', 'subscription_tier', 'logo_url']);
  if (updates.length === 0) {
    return sendError(res, 'No fields to update', 400);
  }

  await query(`
    UPDATE organizations
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...params, req.params.id]);

  const rows = await query('SELECT * FROM organizations WHERE id = ?', [req.params.id]);
  return sendSuccess(res, { organization: rows[0] });
}));

organizationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const adminRows = await query(`
    SELECT o.id
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE o.id = ? AND wm.user_id = ? AND wm.role = 'admin'
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!adminRows[0]) {
    return sendError(res, 'Organization not found or you do not have permission to delete it', 404);
  }

  await query('DELETE FROM organizations WHERE id = ?', [req.params.id]);
  return sendSuccess(res, { message: 'Organization deleted successfully' });
}));

module.exports = { organizationsRouter };
