const express = require('express');
const { query, withTransaction } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');

const rolesRouter = express.Router();
rolesRouter.use(attachCurrentUser, requireAuth);

// Helper to check if user has permission to manage roles
const checkRoleManagePermission = async (workspaceId, userId) => {
  const rows = await query(`
    SELECT rp.permission_id 
    FROM workspace_members wm
    INNER JOIN role_permissions rp ON rp.role_id = wm.role_id
    INNER JOIN permissions p ON p.id = rp.permission_id
    WHERE wm.workspace_id = ? AND wm.user_id = ? AND p.action = 'roles:manage'
  `, [workspaceId, userId]);
  
  return rows.length > 0;
};

const getRoleInWorkspace = async (workspaceId, roleId) => {
  const rows = await query(
    'SELECT id, name, workspace_id FROM roles WHERE id = ? AND workspace_id = ? LIMIT 1',
    [roleId, workspaceId]
  );

  return rows[0] || null;
};

// GET /workspaces/:workspaceId/roles
rolesRouter.get('/workspaces/:workspaceId/roles', asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Verify member
  const memberRows = await query('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, req.currentUser.id]);
  if (!memberRows[0]) return sendError(res, 'Access denied to workspace', 403);

  const roles = await query(`
    SELECT r.id, r.name, r.description, r.is_system_role, COUNT(wm.id) as default_user_count
    FROM roles r
    LEFT JOIN workspace_members wm ON wm.role_id = r.id
    WHERE r.workspace_id = ?
    GROUP BY r.id
    ORDER BY r.is_system_role DESC, r.name ASC
  `, [workspaceId]);

  return sendSuccess(res, { roles });
}));

// POST /workspaces/:workspaceId/roles (Create)
rolesRouter.post('/workspaces/:workspaceId/roles', asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { name, description } = req.body;
  
  const hasPerm = await checkRoleManagePermission(workspaceId, req.currentUser.id);
  if (!hasPerm) return sendError(res, 'You do not have permission to manage roles', 403);

  if (!name || name.trim() === '') return sendValidationError(res, { name: 'Role name is required' });

  // Check unique name
  const existingRows = await query('SELECT id FROM roles WHERE workspace_id = ? AND LOWER(name) = LOWER(?)', [workspaceId, name.trim()]);
  if (existingRows[0]) return sendError(res, 'A role with this name already exists in the workspace', 400);

  const result = await query(
    'INSERT INTO roles (workspace_id, name, description, is_system_role) VALUES (?, ?, ?, false)',
    [workspaceId, name.trim(), description || null]
  );

  const [newRole] = await query('SELECT * FROM roles WHERE id = ?', [result.insertId]);
  
  return sendSuccess(res, { role: newRole }, 201);
}));

// PUT /workspaces/:workspaceId/roles/:roleId (Update)
rolesRouter.put('/workspaces/:workspaceId/roles/:roleId', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  const { name, description } = req.body;
  
  const hasPerm = await checkRoleManagePermission(workspaceId, req.currentUser.id);
  if (!hasPerm) return sendError(res, 'You do not have permission to manage roles', 403);

  const rows = await query('SELECT * FROM roles WHERE id = ? AND workspace_id = ?', [roleId, workspaceId]);
  if (!rows[0]) return sendError(res, 'Role not found', 404);
  if (rows[0].is_system_role && name && name.trim() !== rows[0].name) {
    return sendError(res, 'Cannot rename system roles', 400);
  }

  const finalName = rows[0].is_system_role ? rows[0].name : (name ? name.trim() : rows[0].name);

  // Check unique name if changing
  if (!rows[0].is_system_role && name && name.trim().toLowerCase() !== rows[0].name.toLowerCase()) {
    const existingRows = await query('SELECT id FROM roles WHERE workspace_id = ? AND LOWER(name) = LOWER(?) AND id != ?', [workspaceId, finalName, roleId]);
    if (existingRows[0]) return sendError(res, 'A role with this name already exists', 400);
  }

  await query('UPDATE roles SET name = ?, description = ? WHERE id = ?', [finalName, description || null, roleId]);
  
  const [updatedRole] = await query('SELECT * FROM roles WHERE id = ?', [roleId]);
  return sendSuccess(res, { role: updatedRole });
}));

// DELETE /workspaces/:workspaceId/roles/:roleId
rolesRouter.delete('/workspaces/:workspaceId/roles/:roleId', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  const { fallback_role_id } = req.body; // In case we need to reassign users
  
  const hasPerm = await checkRoleManagePermission(workspaceId, req.currentUser.id);
  if (!hasPerm) return sendError(res, 'You do not have permission to manage roles', 403);

  const rows = await query('SELECT * FROM roles WHERE id = ? AND workspace_id = ?', [roleId, workspaceId]);
  if (!rows[0]) return sendError(res, 'Role not found', 404);
  if (rows[0].is_system_role) return sendError(res, 'Cannot delete system roles', 400);

  await withTransaction(async (connection) => {
    if (fallback_role_id) {
       await connection.execute('UPDATE workspace_members SET role_id = ? WHERE role_id = ? AND workspace_id = ?', [fallback_role_id, roleId, workspaceId]);
    } else {
       // Find 'Member' as fallback
       const [memberRole] = await connection.execute('SELECT id FROM roles WHERE workspace_id = ? AND name = ?', [workspaceId, 'Member']);
       if(memberRole.length > 0) {
           await connection.execute('UPDATE workspace_members SET role_id = ? WHERE role_id = ? AND workspace_id = ?', [memberRole[0].id, roleId, workspaceId]);
       }
    }
    
    await connection.execute('DELETE FROM roles WHERE id = ?', [roleId]);
  });

  return sendSuccess(res, { message: 'Role deleted successfully' });
}));

// GET /workspaces/:workspaceId/roles/:roleId/permissions
rolesRouter.get('/workspaces/:workspaceId/roles/:roleId/permissions', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  
  const memberRows = await query('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, req.currentUser.id]);
  if (!memberRows[0]) return sendError(res, 'Access denied', 403);

  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);

  const permissions = await query(`
    SELECT p.id, p.module, p.action, p.description
    FROM permissions p
    INNER JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role_id = ?
  `, [role.id]);

  return sendSuccess(res, { permissions });
}));

// PUT /workspaces/:workspaceId/roles/:roleId/permissions
rolesRouter.put('/workspaces/:workspaceId/roles/:roleId/permissions', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  const { permission_ids } = req.body; // Array of permission IDs
  
  const hasPerm = await checkRoleManagePermission(workspaceId, req.currentUser.id);
  if (!hasPerm) return sendError(res, 'You do not have permission to manage role permissions', 403);

  if (!Array.isArray(permission_ids)) return sendValidationError(res, { permission_ids: 'Must be an array of permission IDs' });

  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);

  // Do not let them remove all permissions from admin role to prevent lockout
  if (role.name === 'Admin' && permission_ids.length === 0) {
    return sendError(res, 'Cannot remove all permissions from the Admin role', 400);
  }

  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
    
    if (permission_ids.length > 0) {
      // Use parameterized query for safety if possible, or build carefully
      const values = [];
      const params = [];
      for (const pId of permission_ids) {
        values.push('(?, ?)');
        params.push(role.id, pId);
      }
      
      await connection.execute(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values.join(', ')}`,
        params
      );
    }
  });

  return sendSuccess(res, { message: 'Permissions updated successfully' });
}));

// --- PERMISSIONS ROUTES ---
// GET /permissions (List all available permissions to pick from)
rolesRouter.get('/permissions', asyncHandler(async (req, res) => {
  const permissions = await query('SELECT * FROM permissions ORDER BY module ASC, action ASC');
  return sendSuccess(res, { permissions });
}));

module.exports = { rolesRouter };
