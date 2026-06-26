const express = require('express');
const bcrypt = require('bcryptjs');

const crypto = require('crypto');
const { env } = require('../config/env');
const { query, withTransaction, getExistingColumns } = require('../config/database');
const { attachCurrentUser, requireAuth, checkPermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { buildUpdateClause } = require('../utils/validation');
const { sendMail } = require('../utils/mailer');

const workspacesRouter = express.Router();

workspacesRouter.use(attachCurrentUser, requireAuth);

async function getOrganizationWorkspaceSelect() {
  const orgColumns = await getExistingColumns('organizations', [
    'default_language',
    'timezone',
    'date_format',
    'time_format'
  ]);

  const optionalFields = [
    'default_language',
    'timezone',
    'date_format',
    'time_format'
  ].map((column) => (
    orgColumns.has(column) ? `o.${column}` : `NULL AS ${column}`
  ));

  return `
    o.name AS organization_name,
    ${optionalFields.join(',\n           ')}
  `;
}

async function canCreateWorkspaceInOrganization(organizationId, userId) {
  const accessRows = await query(`
    SELECT DISTINCT o.id
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    LEFT JOIN role_permissions rp ON rp.role_id = wm.role_id
    LEFT JOIN permissions p ON p.id = rp.permission_id AND p.action = 'workspaces:create'
    WHERE o.id = ?
      AND wm.user_id = ?
      AND (o.owner_id = ? OR LOWER(COALESCE(wm.role, '')) = 'admin' OR p.id IS NOT NULL)
    LIMIT 1
  `, [organizationId, userId, userId]);

  return Boolean(accessRows[0]);
}

workspacesRouter.get('/', asyncHandler(async (req, res) => {
  const params = [req.currentUser.id];
  let sql = `
    SELECT w.id, w.organization_id, w.name, w.slug, w.description,
           w.logo_url, w.color_theme, w.created_at, w.updated_at,
           o.name AS organization_name,
           r.name AS user_role, r.id AS user_role_id
    FROM workspaces w
    INNER JOIN organizations o ON o.id = w.organization_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    LEFT JOIN roles r ON r.id = wm.role_id
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
  const organizationSelect = await getOrganizationWorkspaceSelect();
  const rows = await query(`
    SELECT w.id, w.organization_id, w.name, w.slug, w.description,
           w.logo_url, w.color_theme, w.created_at, w.updated_at,
           ${organizationSelect},
           r.name AS user_role, r.id AS user_role_id, r.is_system_role
    FROM workspaces w
    INNER JOIN organizations o ON o.id = w.organization_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    LEFT JOIN roles r ON r.id = wm.role_id
    WHERE w.id = ? AND wm.user_id = ? AND w.is_active = TRUE
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!rows[0]) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  const workspace = rows[0];
  let permissions = [];

  if (workspace.user_role_id) {
    const permRows = await query(`
      SELECT p.action
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `, [workspace.user_role_id]);

    permissions = permRows.map(p => p.action);
  }

  return sendSuccess(res, {
    workspace,
    user_permissions: permissions
  });
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

  const canCreate = await canCreateWorkspaceInOrganization(organization_id, req.currentUser.id);
  if (!canCreate) {
    return sendError(res, 'You do not have permission to create workspaces in this organization', 403);
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

    const workspaceId = insertResult.insertId;

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
      SELECT w.id, w.organization_id, w.name, w.slug, w.description,
             w.logo_url, w.color_theme, w.created_at, w.updated_at,
             o.name AS organization_name,
             r.name AS user_role, r.id AS user_role_id
      FROM workspaces w
      INNER JOIN organizations o ON o.id = w.organization_id
      INNER JOIN roles r ON r.id = ?
      WHERE w.id = ?
    `, [roleIds['Admin'], workspaceId]);

    return rows[0];
  });

  return sendSuccess(res, { workspace }, 201);
}));

workspacesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const isMember = await query(`
    SELECT w.id, w.organization_id
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  const existingWorkspace = isMember[0];
  if (!existingWorkspace) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  const canEdit = await checkPermission(req.params.id, req.currentUser.id, 'workspaces:edit');
  if (!canEdit) {
    return sendError(res, 'You do not have permission to edit this workspace', 403);
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
  const isMember = await query(`
    SELECT w.id
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ?
    LIMIT 1
  `, [req.params.id, req.currentUser.id]);

  if (!isMember[0]) {
    return sendError(res, 'Workspace not found or access denied', 404);
  }

  const canDelete = await checkPermission(req.params.id, req.currentUser.id, 'workspaces:delete');
  if (!canDelete) {
    return sendError(res, 'You do not have permission to delete this workspace', 403);
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

  const canViewMembers = await checkPermission(req.params.workspaceId, req.currentUser.id, 'members:view');
  if (!canViewMembers) {
    return sendError(res, 'You do not have permission to view workspace members', 403);
  }

  const members = await query(`
    SELECT wm.id AS membership_id, r.name AS role, wm.created_at,
           u.id AS user_id, u.first_name, u.last_name, u.email
    FROM workspace_members wm
    INNER JOIN users u ON u.id = wm.user_id
    LEFT JOIN roles r ON r.id = wm.role_id
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
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  const canInvite = await checkPermission(req.params.workspaceId, req.currentUser.id, 'members:invite');

  if (!canInvite) {
    errors.workspace_id = 'You do not have permission to add members to this workspace';
  }

  if (action === 'create') {
    if (!String(req.body.first_name || '').trim()) {
      errors.first_name = 'First name is required';
    }
    if (!String(req.body.last_name || '').trim()) {
      errors.last_name = 'Last name is required';
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  // Check if already a member before proceeding with user creation/fetch
  const existingMemberships = await query(`
    SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)
  `, [req.params.workspaceId, email]);

  if (existingMemberships.length > 0) {
    return sendValidationError(res, { email: 'User is already a member of this workspace' });
  }

  const workspaceRows = await query('SELECT name FROM workspaces WHERE id = ?', [req.params.workspaceId]);
  const workspaceName = workspaceRows[0] ? workspaceRows[0].name : 'Workspace';

  const member = await withTransaction(async (connection) => {
    let user_id_to_add;

    if (action === 'create') {
      const [existingUsers] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUsers[0]) {
        const error = new Error('validation');
        error.statusCode = 422;
        error.payload = { email: 'User with this email already exists in the system.' };
        throw error;
      }

      // Generate a truly random temporary password
      const tempPassword = crypto.randomBytes(12).toString('hex') + '!';
      const password_hash = await bcrypt.hash(tempPassword, 10);

      const [userResult] = await connection.execute(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active)
        VALUES (?, ?, ?, ?, FALSE)
      `, [email, password_hash, String(req.body.first_name).trim(), String(req.body.last_name).trim()]);
      user_id_to_add = userResult.insertId;

      // Token Generation
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours expiry for invitations

      await connection.execute(`
        INSERT INTO email_verification_tokens (email, token, expires_at)
        VALUES (?, ?, ?)
      `, [email, token, expiresAt]);

      // Verification Link
      const verifyLink = `${env.appOrigin}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

      // Verification Email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Welcome to Zentrix!</h2>
          <p>Hi ${req.body.first_name},</p>
          <p><strong>${req.currentUser.first_name} ${req.currentUser.last_name}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace.</p>
          <p>Please click the button below to verify your email address and activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify & Join Workspace</a>
          </div>
          <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">This link will expire in 48 hours.</p>
        </div>
      `;
      await sendMail({
        to: email,
        subject: `Zentrix - Invitation to ${workspaceName}`,
        html: htmlContent
      });

    }
    else {
      const [users] = await connection.execute('SELECT id, first_name FROM users WHERE email = ?', [email]);
      if (!users[0]) {
        const error = new Error('No user found with that email address. They must register first.');
        error.statusCode = 400;
        throw error;
      }
      user_id_to_add = users[0].id;
      const userName = users[0].first_name;

      // Notification Email for existing user
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5;">New Workspace Added!</h2>
          <p>Hi ${userName},</p>
          <p><strong>${req.currentUser.first_name} ${req.currentUser.last_name}</strong> has added you to the <strong>${workspaceName}</strong> workspace.</p>
          <p>You can now access its projects and tasks from your dashboard.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${env.appOrigin}/dashboard" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
          </div>
        </div>
      `;

      await sendMail({
        to: email,
        subject: `Zentrix - New Workspace: ${workspaceName}`,
        html: htmlContent
      });
    }

    // Double check membership within transaction to avoid race conditions
    const [finalMembershipCheck] = await connection.execute(`
      SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?
    `, [req.params.workspaceId, user_id_to_add]);

    if (finalMembershipCheck[0]) {
      const error = new Error('User is already a member of this workspace');
      error.statusCode = 409;
      throw error;
    }

    const [membershipResult] = await connection.execute(`
      INSERT INTO workspace_members (workspace_id, user_id, role_id)
      VALUES (?, ?, 
        CASE 
          WHEN ? REGEXP '^[0-9]+$' THEN ?
          ELSE (SELECT id FROM roles WHERE workspace_id = ? AND LOWER(name) = LOWER(?) LIMIT 1)
        END
      )
    `, [req.params.workspaceId, user_id_to_add, role, role, req.params.workspaceId, role]);

    const [rows] = await connection.execute(`
      SELECT wm.id AS membership_id, r.name AS role, wm.created_at,
             u.id AS user_id, u.first_name, u.last_name, u.email
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      LEFT JOIN roles r ON r.id = wm.role_id
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

workspacesRouter.put('/members/:membershipId', asyncHandler(async (req, res) => {
  const { role_id, first_name, last_name, email } = req.body;

  const targetRows = await query(`
    SELECT wm.workspace_id, wm.user_id, r.name AS role_name, r.is_system_role 
    FROM workspace_members wm 
    LEFT JOIN roles r ON r.id = wm.role_id
    WHERE wm.id = ?
  `, [req.params.membershipId]);

  const targetMember = targetRows[0];
  if (!targetMember) {
    return sendError(res, 'Membership not found', 404);
  }

  const canManageRoles = await checkPermission(targetMember.workspace_id, req.currentUser.id, 'members:manage_roles');
  if (!canManageRoles) {
    return sendError(res, 'You do not have permission to edit member details in this workspace', 403);
  }

  const errors = {};

  // Check role update logic
  if (role_id) {
    const newRoleRows = await query('SELECT name FROM roles WHERE id = ?', [role_id]);
    if (!newRoleRows[0]) {
      errors.role_id = 'The selected role does not exist';
    } else if (targetMember.role_name === 'Admin' && newRoleRows[0].name !== 'Admin') {
      const adminRows = await query(`
        SELECT COUNT(*) AS admin_count
        FROM workspace_members wm
        JOIN roles r ON r.id = wm.role_id
        WHERE wm.workspace_id = ? AND r.name = 'Admin' AND wm.user_id != ?
      `, [targetMember.workspace_id, targetMember.user_id]);

      if (Number(adminRows[0].admin_count) === 0) {
        errors.role_id = 'Cannot demote the last administrator. Promote someone else first.';
      }
    }
  }

  if (first_name || last_name || email) {
    errors.profile = 'Profile updates must be managed from the user account settings.';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  await withTransaction(async (connection) => {
    if (role_id) {
      await connection.execute('UPDATE workspace_members SET role_id = ? WHERE id = ?', [role_id, req.params.membershipId]);
    }

  });

  return sendSuccess(res, { message: 'Member details updated successfully' });
}));

workspacesRouter.delete('/members/:membershipId', asyncHandler(async (req, res) => {
  const targetRows = await query(`
    SELECT wm.workspace_id, wm.user_id, r.name AS role_name, r.is_system_role 
    FROM workspace_members wm 
    LEFT JOIN roles r ON r.id = wm.role_id
    WHERE wm.id = ?
  `, [req.params.membershipId]);

  const targetMember = targetRows[0];
  if (!targetMember) {
    return sendError(res, 'Membership not found', 404);
  }

  if (Number(targetMember.user_id) !== Number(req.currentUser.id)) {
    const canRemove = await checkPermission(targetMember.workspace_id, req.currentUser.id, 'members:remove');

    if (!canRemove) {
      return sendError(res, 'You do not have permission to remove members from this workspace', 403);
    }
  }

  if (targetMember.role_name === 'Admin') {
    const adminRows = await query(`
      SELECT COUNT(*) AS admin_count
      FROM workspace_members wm
      JOIN roles r ON r.id = wm.role_id
      WHERE wm.workspace_id = ? AND r.name = 'Admin'
    `, [targetMember.workspace_id]);

    if (Number(adminRows[0].admin_count) <= 1) {
      return sendError(res, 'Cannot remove the last administrator. Promote someone else first.', 400);
    }
  }

  await withTransaction(async (connection) => {
    // Removing the member's workspace-scoped project memberships prevents stale ownership access.
    await connection.execute(`
      DELETE pm
      FROM project_members pm
      INNER JOIN projects p ON p.id = pm.project_id
      WHERE p.workspace_id = ? AND pm.user_id = ?
    `, [targetMember.workspace_id, targetMember.user_id]);

    await connection.execute('DELETE FROM workspace_members WHERE id = ?', [req.params.membershipId]);
  });

  return sendSuccess(res, { message: 'Member removed successfully' });
}));

module.exports = { workspacesRouter };
