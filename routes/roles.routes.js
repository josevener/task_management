const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');

const rolesRouter = express.Router();
rolesRouter.use(attachCurrentUser, requireAuth);

async function hasRolePermission(workspaceId, userId, actions) {
  const requestedActions = Array.isArray(actions) ? actions : [actions];
  if (requestedActions.length === 0) {
    return false;
  }

  const count = await prisma.workspaceMember.count({
    where: {
      workspaceId: parseInt(workspaceId, 10),
      userId: parseInt(userId, 10),
      roleObj: {
        rolePermissions: {
          some: {
            permission: {
              action: { in: requestedActions }
            }
          }
        }
      }
    }
  });
  
  return count > 0;
}

const getRoleInWorkspace = async (workspaceId, roleId) => {
  return prisma.role.findFirst({
    where: {
      id: parseInt(roleId, 10),
      workspaceId: parseInt(workspaceId, 10)
    },
    select: {
      id: true,
      name: true,
      workspaceId: true
    }
  });
};

// GET /workspaces/:workspaceId/roles
rolesRouter.get('/workspaces/:workspaceId/roles', asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Verify member
  const hasPerm = await hasRolePermission(workspaceId, req.currentUser.id, ['roles:view', 'roles:manage']);
  if (!hasPerm) return sendError(res, 'You do not have permission to view roles', 403);

  const roles = await prisma.role.findMany({
    where: {
      workspaceId: parseInt(workspaceId, 10)
    },
    select: {
      id: true,
      name: true,
      description: true,
      isSystemRole: true,
      _count: {
        select: {
          members: true
        }
      }
    },
    orderBy: [
      { isSystemRole: 'desc' },
      { name: 'asc' }
    ]
  });

  const mappedRoles = roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    is_system_role: r.isSystemRole,
    default_user_count: r._count.members
  }));

  return sendSuccess(res, { roles: mappedRoles });
}));

// POST /workspaces/:workspaceId/roles (Create)
rolesRouter.post('/workspaces/:workspaceId/roles', asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { name, description } = req.body;
  
  const hasPerm = await hasRolePermission(workspaceId, req.currentUser.id, ['roles:create', 'roles:manage']);
  if (!hasPerm) return sendError(res, 'You do not have permission to create roles', 403);

  if (!name || name.trim() === '') return sendValidationError(res, { name: 'Role name is required' });

  // Check unique name
  const existing = await prisma.role.findFirst({
    where: {
      workspaceId: parseInt(workspaceId, 10),
      name: {
        equals: name.trim()
      }
    }
  });
  if (existing) return sendError(res, 'A role with this name already exists in the workspace', 400);

  const newRole = await prisma.role.create({
    data: {
      workspaceId: parseInt(workspaceId, 10),
      name: name.trim(),
      description: description || null,
      isSystemRole: false
    }
  });

  const mappedRole = {
    id: newRole.id,
    workspace_id: newRole.workspaceId,
    name: newRole.name,
    description: newRole.description,
    is_system_role: newRole.isSystemRole,
    created_at: newRole.createdAt,
    updated_at: newRole.updatedAt
  };
  
  return sendSuccess(res, { role: mappedRole }, 201);
}));

// PUT /workspaces/:workspaceId/roles/:roleId (Update)
rolesRouter.put('/workspaces/:workspaceId/roles/:roleId', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  const { name, description } = req.body;
  
  const hasPerm = await hasRolePermission(workspaceId, req.currentUser.id, ['roles:edit', 'roles:manage']);
  if (!hasPerm) return sendError(res, 'You do not have permission to edit roles', 403);

  const role = await prisma.role.findFirst({
    where: {
      id: parseInt(roleId, 10),
      workspaceId: parseInt(workspaceId, 10)
    }
  });
  if (!role) return sendError(res, 'Role not found', 404);
  if (role.isSystemRole && name && name.trim() !== role.name) {
    return sendError(res, 'Cannot rename system roles', 400);
  }

  const finalName = role.isSystemRole ? role.name : (name ? name.trim() : role.name);

  // Check unique name if changing
  if (!role.isSystemRole && name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
    const existing = await prisma.role.findFirst({
      where: {
        workspaceId: parseInt(workspaceId, 10),
        name: {
          equals: finalName
        },
        id: {
          not: parseInt(roleId, 10)
        }
      }
    });
    if (existing) return sendError(res, 'A role with this name already exists', 400);
  }

  const updatedRole = await prisma.role.update({
    where: {
      id: parseInt(roleId, 10)
    },
    data: {
      name: finalName,
      description: description !== undefined ? (description || null) : undefined
    }
  });

  const mappedRole = {
    id: updatedRole.id,
    workspace_id: updatedRole.workspaceId,
    name: updatedRole.name,
    description: updatedRole.description,
    is_system_role: updatedRole.isSystemRole,
    created_at: updatedRole.createdAt,
    updated_at: updatedRole.updatedAt
  };
  
  return sendSuccess(res, { role: mappedRole });
}));

// DELETE /workspaces/:workspaceId/roles/:roleId
rolesRouter.delete('/workspaces/:workspaceId/roles/:roleId', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  const { fallback_role_id } = req.body; // In case we need to reassign users
  
  const hasPerm = await hasRolePermission(workspaceId, req.currentUser.id, ['roles:delete', 'roles:manage']);
  if (!hasPerm) return sendError(res, 'You do not have permission to delete roles', 403);

  const role = await prisma.role.findFirst({
    where: {
      id: parseInt(roleId, 10),
      workspaceId: parseInt(workspaceId, 10)
    }
  });
  if (!role) return sendError(res, 'Role not found', 404);
  if (role.isSystemRole) return sendError(res, 'Cannot delete system roles', 400);

  await prisma.$transaction(async (tx) => {
    let targetRoleId = fallback_role_id ? parseInt(fallback_role_id, 10) : null;
    
    if (!targetRoleId) {
       // Find 'Member' as fallback
       const memberRole = await tx.role.findFirst({
         where: {
           workspaceId: parseInt(workspaceId, 10),
           name: 'Member'
         }
       });
       if (memberRole) {
           targetRoleId = memberRole.id;
       }
    }
    
    if (targetRoleId) {
      await tx.workspaceMember.updateMany({
        where: {
          roleId: parseInt(roleId, 10),
          workspaceId: parseInt(workspaceId, 10)
        },
        data: {
          roleId: targetRoleId
        }
      });
    }
    
    await tx.role.delete({
      where: {
        id: parseInt(roleId, 10)
      }
    });
  });

  return sendSuccess(res, { message: 'Role deleted successfully' });
}));

// GET /workspaces/:workspaceId/roles/:roleId/permissions
rolesRouter.get('/workspaces/:workspaceId/roles/:roleId/permissions', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  
  const hasPerm = await hasRolePermission(workspaceId, req.currentUser.id, ['roles:view', 'roles:manage']);
  if (!hasPerm) return sendError(res, 'You do not have permission to view role permissions', 403);

  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);

  const permissions = await prisma.permission.findMany({
    where: {
      rolePermissions: {
        some: {
          roleId: role.id
        }
      }
    },
    select: {
      id: true,
      module: true,
      action: true,
      description: true
    }
  });

  return sendSuccess(res, { permissions });
}));

// PUT /workspaces/:workspaceId/roles/:roleId/permissions
rolesRouter.put('/workspaces/:workspaceId/roles/:roleId/permissions', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  const { permission_ids } = req.body; // Array of permission IDs
  
  const hasPerm = await hasRolePermission(workspaceId, req.currentUser.id, ['roles:edit', 'roles:manage']);
  if (!hasPerm) return sendError(res, 'You do not have permission to manage role permissions', 403);

  if (!Array.isArray(permission_ids)) return sendValidationError(res, { permission_ids: 'Must be an array of permission IDs' });

  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);

  // Do not let them remove all permissions from admin role to prevent lockout
  if (role.name === 'Admin' && permission_ids.length === 0) {
    return sendError(res, 'Cannot remove all permissions from the Admin role', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: {
        roleId: role.id
      }
    });
    
    if (permission_ids.length > 0) {
      await tx.rolePermission.createMany({
        data: permission_ids.map(pId => ({
          roleId: role.id,
          permissionId: parseInt(pId, 10)
        }))
      });
    }
  });

  return sendSuccess(res, { message: 'Permissions updated successfully' });
}));

// --- PERMISSIONS ROUTES ---
// GET /permissions (List all available permissions to pick from)
rolesRouter.get('/permissions', asyncHandler(async (req, res) => {
  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      module: true,
      action: true,
      description: true,
      createdAt: true
    },
    orderBy: [
      { module: 'asc' },
      { action: 'asc' }
    ]
  });

  const mappedPermissions = permissions.map(p => ({
    id: p.id,
    module: p.module,
    action: p.action,
    description: p.description,
    created_at: p.createdAt
  }));

  return sendSuccess(res, { permissions: mappedPermissions });
}));

module.exports = { rolesRouter };
