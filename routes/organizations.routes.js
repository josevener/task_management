const express = require('express');

const { query, withTransaction, getExistingColumns } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { buildUpdateClause } = require('../utils/validation');

const organizationsRouter = express.Router();

organizationsRouter.use(attachCurrentUser, requireAuth);

async function canCreateOrganization(userId) {
  const membershipRows = await query(`
    SELECT wm.id
    FROM workspace_members wm
    WHERE wm.user_id = ?
    LIMIT 1
  `, [userId]);

  if (!membershipRows[0]) {
    return true;
  }

  const permissionRows = await query(`
    SELECT rp.permission_id
    FROM workspace_members wm
    INNER JOIN role_permissions rp ON rp.role_id = wm.role_id
    INNER JOIN permissions p ON p.id = rp.permission_id
    WHERE wm.user_id = ? AND p.action = 'organizations:create'
    LIMIT 1
  `, [userId]);

  return Boolean(permissionRows[0]);
}

async function canManageOrganization(userId, organizationId) {
  const accessRows = await query(`
    SELECT DISTINCT o.id
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    LEFT JOIN role_permissions rp ON rp.role_id = wm.role_id
    LEFT JOIN permissions p ON p.id = rp.permission_id AND p.action = 'organizations:edit'
    WHERE o.id = ?
      AND wm.user_id = ?
      AND (o.owner_id = ? OR LOWER(COALESCE(wm.role, '')) = 'admin' OR p.id IS NOT NULL)
    LIMIT 1
  `, [organizationId, userId, userId]);

  return Boolean(accessRows[0]);
}

async function getOrganizationSelectFields() {
  const optionalColumns = [
    'timezone',
    'default_language',
    'date_format',
    'time_format',
    'subscription_status',
    'owner_id'
  ];

  const existingColumns = await getExistingColumns('organizations', optionalColumns);

  const baseColumns = [
    'o.id',
    'o.name',
    'o.slug',
    'o.logo_url',
    'o.subscription_tier'
  ];

  const optionalSelects = optionalColumns.map((column) => (
    existingColumns.has(column) ? `o.${column}` : `NULL AS ${column}`
  ));

  return [...baseColumns, ...optionalSelects, 'o.created_at', 'o.updated_at'].join(',\n      ');
}

organizationsRouter.get('/', asyncHandler(async (req, res) => {
  const selectFields = await getOrganizationSelectFields();
  const organizations = await query(`
    SELECT DISTINCT 
      ${selectFields}
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ? AND o.is_active = TRUE
    ORDER BY o.created_at DESC
  `, [req.currentUser.id]);

  return sendSuccess(res, { organizations });
}));

organizationsRouter.get('/:id', asyncHandler(async (req, res) => {
  const selectFields = await getOrganizationSelectFields();
  const rows = await query(`
    SELECT DISTINCT 
      ${selectFields}
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

  const canCreate = await canCreateOrganization(req.currentUser.id);
  if (!canCreate) {
    return sendError(res, 'You do not have permission to create organizations', 403);
  }

  const existing = await query('SELECT id FROM organizations WHERE slug = ?', [slug]);
  if (existing.length > 0) {
    return sendValidationError(res, { slug: 'This slug is already taken' });
  }

  const organization = await withTransaction(async (connection) => {
    const [organizationResult] = await connection.execute(`
      INSERT INTO organizations (name, slug, subscription_tier, owner_id)
      VALUES (?, ?, ?, ?)
    `, [name, slug, req.body.subscription_tier || 'free', req.currentUser.id]);

    const workspace_name = `${name} Workspace`;
    const workspace_slug = `${slug}-workspace`;

    const [workspaceResult] = await connection.execute(`
      INSERT INTO workspaces (organization_id, name, slug)
      VALUES (?, ?, ?)
    `, [organizationResult.insertId, workspace_name, workspace_slug]);

    const workspaceId = workspaceResult.insertId;

    // 1. Provision Default Roles
    const defaultRoles = [
      ['Admin', 'Full administrative access', true],
      ['Manager', 'Can manage projects, tasks, and members.', true],
      ['Member', 'Can create and manage tasks.', true],
      ['Guest', 'View-only access.', true]
    ];

    const roleIds = {};
    for (const [rName, rDesc, isSystem] of defaultRoles) {
      const [rResult] = await connection.execute(
        'INSERT INTO roles (workspace_id, name, description, is_system_role) VALUES (?, ?, ?, ?)',
        [workspaceId, rName, rDesc, isSystem]
      );
      roleIds[rName] = rResult.insertId;
    }

    // 2. Grant Permissions to Admin Role
    const [permissions] = await connection.execute('SELECT id FROM permissions');
    if (permissions.length > 0) {
      const values = permissions.map(p => `(${roleIds['Admin']}, ${p.id})`).join(', ');
      await connection.execute(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ${values}
      `);
    }

    // 3. Add user as Admin member
    await connection.execute(`
      INSERT INTO workspace_members (workspace_id, user_id, role_id, role)
      VALUES (?, ?, ?, 'Admin')
    `, [workspaceId, req.currentUser.id, roleIds['Admin']]);

    const [rows] = await connection.execute(`
      SELECT id, name, slug, logo_url, subscription_tier, owner_id, created_at, updated_at
      FROM organizations
      WHERE id = ?
    `, [organizationResult.insertId]);

    const [wsRows] = await connection.execute(`
      SELECT w.id, w.name, w.slug, w.organization_id, w.color_theme,
             r.name AS user_role, r.id AS user_role_id
      FROM workspaces w
      INNER JOIN roles r ON r.id = ?
      WHERE w.id = ?
    `, [roleIds['Admin'], workspaceId]);

    return {
      organization: rows[0],
      workspace: wsRows[0]
    };
  });

  return sendSuccess(res, organization, 201);
}));

organizationsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const canManage = await canManageOrganization(req.currentUser.id, req.params.id);
  if (!canManage) {
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

  const optionalFields = ['timezone', 'default_language', 'date_format', 'time_format', 'subscription_status'];
  const existingColumns = await getExistingColumns('organizations', optionalFields);
  const unsupportedFieldErrors = {};

  for (const field of optionalFields) {
    if (Object.prototype.hasOwnProperty.call(input, field) && !existingColumns.has(field)) {
      unsupportedFieldErrors[field] = 'This setting is unavailable until the organization settings migration is applied';
    }
  }

  if (Object.keys(unsupportedFieldErrors).length > 0) {
    return sendValidationError(res, unsupportedFieldErrors);
  }

  const { updates, params } = buildUpdateClause(input, [
    'name', 'slug', 'subscription_tier', 'logo_url',
    ...optionalFields.filter((field) => existingColumns.has(field))
  ]);
  if (updates.length === 0) {
    return sendError(res, 'No fields to update', 400);
  }

  await query(`
    UPDATE organizations
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...params, req.params.id]);

  const selectFields = await getOrganizationSelectFields();
  const rows = await query(`
    SELECT ${selectFields}
    FROM organizations o
    WHERE o.id = ?
    LIMIT 1
  `, [req.params.id]);
  return sendSuccess(res, { organization: rows[0] });
}));

organizationsRouter.get('/:id/members', asyncHandler(async (req, res) => {
  const canManage = await canManageOrganization(req.currentUser.id, req.params.id);
  if (!canManage) {
    return sendError(res, 'Organization not found or access denied', 404);
  }

  const members = await query(`
    SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.avatar_url, MAX(wm.role) as role
    FROM users u
    INNER JOIN workspace_members wm ON wm.user_id = u.id
    INNER JOIN workspaces w ON w.id = wm.workspace_id
    WHERE w.organization_id = ?
    GROUP BY u.id
  `, [req.params.id]);

  return sendSuccess(res, { members });
}));

organizationsRouter.post('/:id/transfer-ownership', asyncHandler(async (req, res) => {
  const { new_owner_id } = req.body;
  
  if (!new_owner_id) {
    return sendValidationError(res, { new_owner_id: 'New owner ID is required' });
  }

  // ONLY the organization owner can transfer ownership
  const adminRows = await query(`
    SELECT o.id, o.owner_id
    FROM organizations o
    WHERE o.id = ? AND o.owner_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!adminRows[0]) {
    return sendError(res, 'Only the organization owner can transfer ownership', 403);
  }

  // Check if new owner exists and is a member of at least one workspace in the organization
  const memberRows = await query(`
    SELECT wm.user_id
    FROM workspace_members wm
    INNER JOIN workspaces w ON w.id = wm.workspace_id
    WHERE w.organization_id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, new_owner_id]);

  if (!memberRows[0]) {
    return sendError(res, 'New owner must be a member of the organization', 400);
  }

  await query(`
    UPDATE organizations
    SET owner_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [new_owner_id, req.params.id]);

  return sendSuccess(res, { message: 'Ownership transferred successfully' });
}));

organizationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  // ONLY the organization owner can delete the organization
  const adminRows = await query(`
    SELECT o.id, o.owner_id
    FROM organizations o
    WHERE o.id = ? AND o.owner_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!adminRows[0]) {
    return sendError(res, 'Only the organization owner can delete this organization', 403);
  }

  await query('DELETE FROM organizations WHERE id = ?', [req.params.id]);
  return sendSuccess(res, { message: 'Organization deleted successfully' });
}));

module.exports = { organizationsRouter };
