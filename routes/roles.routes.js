const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { publicIdParam, resolveInternalId } = require('../utils/public-id');
const { getActorRolePolicy, canGrantPermissionActions } = require('../utils/role-policy');

const rolesRouter = express.Router();
rolesRouter.use(attachCurrentUser, requireAuth);
rolesRouter.param('workspaceId', publicIdParam(prisma, 'Workspace'));
rolesRouter.param('roleId', publicIdParam(prisma, 'Role'));

const roleSelect = (withCount = false) => ({
  id: true, publicId: true, workspaceId: true, name: true, description: true, isSystemRole: true, createdAt: true, updatedAt: true,
  workspace: { select: { publicId: true } },
  ...(withCount ? { _count: { select: { members: true } } } : {}),
});
const mapRole = (role) => ({
  id: role.publicId, public_id: role.publicId, workspace_id: role.workspace?.publicId, workspace_public_id: role.workspace?.publicId,
  name: role.name, description: role.description, is_system_role: Boolean(role.isSystemRole), default_user_count: role._count?.members,
  created_at: role.createdAt, updated_at: role.updatedAt,
});
async function hasRolePermission(workspaceId, userId, actions) {
  return (await prisma.workspaceMember.count({ where: { workspaceId: Number(workspaceId), userId: Number(userId), roleObj: { rolePermissions: { some: { permission: { action: { in: actions } } } } } } })) > 0;
}
async function requireRolePermission(res, workspaceId, userId, actions, message) {
  if (await hasRolePermission(workspaceId, userId, actions)) return true;
  sendError(res, message, 403); return false;
}
async function getRoleInWorkspace(workspaceId, roleId, select = roleSelect()) {
  return prisma.role.findFirst({ where: { id: Number(roleId), workspaceId: Number(workspaceId) }, select });
}
async function resolvePermissions(publicIds) {
  if (!Array.isArray(publicIds) || publicIds.some((id) => typeof id !== 'string')) return { errors: { permission_ids: 'Must be an array of permission public IDs' } };
  const uniqueIds = [...new Set(publicIds)];
  const permissions = await prisma.permission.findMany({ where: { publicId: { in: uniqueIds } }, select: { id: true, publicId: true, action: true } });
  return permissions.length === uniqueIds.length ? { permissions } : { errors: { permission_ids: 'One or more selected permissions are invalid' } };
}

rolesRouter.get('/workspaces/:workspaceId/roles', asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:view', 'roles:manage'], 'You do not have permission to view roles')) return;
  const roles = await prisma.role.findMany({ where: { workspaceId: Number(workspaceId) }, select: roleSelect(true), orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }] });
  return sendSuccess(res, { roles: roles.map(mapRole) });
}));

rolesRouter.post('/workspaces/:workspaceId/roles', asyncHandler(async (req, res) => {
  const { workspaceId } = req.params; const { name, description } = req.body;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:create', 'roles:manage'], 'You do not have permission to create roles')) return;
  if (typeof name !== 'string' || !name.trim()) return sendValidationError(res, { name: 'Role name is required' });
  const normalizedName = name.trim();
  if (await prisma.role.findFirst({ where: { workspaceId: Number(workspaceId), name: { equals: normalizedName } }, select: { id: true } })) return sendValidationError(res, { name: 'A role with this name already exists in the workspace' });
  const role = await prisma.role.create({ data: { workspaceId: Number(workspaceId), name: normalizedName, description: typeof description === 'string' && description.trim() ? description.trim() : null, isSystemRole: false }, select: roleSelect() });
  return sendSuccess(res, { role: mapRole(role) }, 201);
}));

rolesRouter.post('/workspaces/:workspaceId/roles/:roleId/duplicate', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params; const { name, description } = req.body;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:create', 'roles:manage'], 'You do not have permission to create roles')) return;
  if (typeof name !== 'string' || !name.trim()) return sendValidationError(res, { name: 'Role name is required' });
  const source = await getRoleInWorkspace(workspaceId, roleId, { ...roleSelect(), rolePermissions: { select: { permission: { select: { id: true, action: true } } } } });
  if (!source) return sendError(res, 'Role not found', 404);
  if (source.isSystemRole) return sendError(res, 'System roles cannot be duplicated', 400);
  const policy = await getActorRolePolicy(prisma, workspaceId, req.currentUser.id);
  if (!canGrantPermissionActions(policy, source.rolePermissions.map(({ permission }) => permission.action))) return sendError(res, 'You cannot duplicate a role with permissions you do not hold', 403);
  const normalizedName = name.trim();
  try {
    const duplicate = await prisma.$transaction(async (tx) => {
      if (await tx.role.findFirst({ where: { workspaceId: Number(workspaceId), name: { equals: normalizedName } }, select: { id: true } })) { const error = new Error('A role with this name already exists in the workspace'); error.validationErrors = { name: error.message }; throw error; }
      const role = await tx.role.create({ data: { workspaceId: Number(workspaceId), name: normalizedName, description: typeof description === 'string' ? description.trim() || null : source.description, isSystemRole: false }, select: roleSelect() });
      if (source.rolePermissions.length) await tx.rolePermission.createMany({ data: source.rolePermissions.map(({ permission }) => ({ roleId: role.id, permissionId: permission.id })) });
      return role;
    });
    return sendSuccess(res, { role: mapRole(duplicate) }, 201);
  } catch (error) { if (error.validationErrors) return sendValidationError(res, error.validationErrors); throw error; }
}));

rolesRouter.put('/workspaces/:workspaceId/roles/:roleId', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params; const { name, description } = req.body;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:edit', 'roles:manage'], 'You do not have permission to edit roles')) return;
  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);
  if (role.isSystemRole) return sendError(res, 'System roles cannot be edited', 400);
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) return sendValidationError(res, { name: 'Role name is required' });
  const finalName = name === undefined ? role.name : name.trim();
  if (finalName.toLowerCase() !== role.name.toLowerCase() && await prisma.role.findFirst({ where: { workspaceId: Number(workspaceId), name: { equals: finalName }, id: { not: role.id } }, select: { id: true } })) return sendValidationError(res, { name: 'A role with this name already exists in the workspace' });
  const updated = await prisma.role.update({ where: { id: role.id }, data: { name: finalName, description: description === undefined ? undefined : (typeof description === 'string' && description.trim() ? description.trim() : null) }, select: roleSelect() });
  return sendSuccess(res, { role: mapRole(updated) });
}));

rolesRouter.delete('/workspaces/:workspaceId/roles/:roleId', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params; const { fallback_role_public_id } = req.body;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:delete', 'roles:manage'], 'You do not have permission to delete roles')) return;
  const role = await getRoleInWorkspace(workspaceId, roleId, roleSelect(true));
  if (!role) return sendError(res, 'Role not found', 404);
  if (role.isSystemRole) return sendError(res, 'System roles cannot be deleted', 400);
  let fallbackRoleId = null;
  if (fallback_role_public_id) {
    fallbackRoleId = await resolveInternalId(prisma, 'Role', fallback_role_public_id, 'fallback_role_public_id');
    const fallback = fallbackRoleId && await prisma.role.findFirst({ where: { id: fallbackRoleId, workspaceId: Number(workspaceId) }, select: { id: true, rolePermissions: { select: { permission: { select: { action: true } } } } } });
    if (!fallback || fallback.id === role.id) return sendValidationError(res, { fallback_role_public_id: 'Fallback role must be a different role in this workspace' });
    const actorPolicy = await getActorRolePolicy(prisma, workspaceId, req.currentUser.id);
    if (!canGrantPermissionActions(actorPolicy, fallback.rolePermissions.map(({ permission }) => permission.action))) return sendError(res, 'You cannot reassign members to a role with permissions you do not hold', 403);
  }
  if (role._count.members > 0 && !fallbackRoleId) return sendValidationError(res, { fallback_role_public_id: 'Select a fallback role before deleting a role with assigned members' });
  await prisma.$transaction(async (tx) => { if (fallbackRoleId) await tx.workspaceMember.updateMany({ where: { workspaceId: Number(workspaceId), roleId: role.id }, data: { roleId: fallbackRoleId } }); await tx.role.delete({ where: { id: role.id } }); });
  return sendSuccess(res, { message: 'Role deleted successfully' });
}));

rolesRouter.get('/workspaces/:workspaceId/roles/:roleId/permissions', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:view', 'roles:manage'], 'You do not have permission to view role permissions')) return;
  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);
  const permissions = await prisma.permission.findMany({ where: { rolePermissions: { some: { roleId: role.id } } }, select: { publicId: true, module: true, action: true, description: true } });
  return sendSuccess(res, { permissions: permissions.map((permission) => ({ id: permission.publicId, public_id: permission.publicId, module: permission.module, action: permission.action, description: permission.description })) });
}));

rolesRouter.put('/workspaces/:workspaceId/roles/:roleId/permissions', asyncHandler(async (req, res) => {
  const { workspaceId, roleId } = req.params;
  if (!await requireRolePermission(res, workspaceId, req.currentUser.id, ['roles:create', 'roles:edit', 'roles:manage'], 'You do not have permission to manage role permissions')) return;
  const role = await getRoleInWorkspace(workspaceId, roleId);
  if (!role) return sendError(res, 'Role not found', 404);
  if (role.isSystemRole) return sendError(res, 'System role permissions cannot be changed', 400);
  const resolved = await resolvePermissions(req.body.permission_ids);
  if (resolved.errors) return sendValidationError(res, resolved.errors);
  const policy = await getActorRolePolicy(prisma, workspaceId, req.currentUser.id);
  if (!canGrantPermissionActions(policy, resolved.permissions.map((permission) => permission.action))) return sendError(res, 'You cannot grant permissions you do not hold', 403);
  await prisma.$transaction(async (tx) => { await tx.rolePermission.deleteMany({ where: { roleId: role.id } }); if (resolved.permissions.length) await tx.rolePermission.createMany({ data: resolved.permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) }); });
  return sendSuccess(res, { message: 'Permissions updated successfully' });
}));

rolesRouter.get('/permissions', asyncHandler(async (_req, res) => {
  const permissions = await prisma.permission.findMany({ select: { publicId: true, module: true, action: true, description: true, createdAt: true }, orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  return sendSuccess(res, { permissions: permissions.map((permission) => ({ id: permission.publicId, public_id: permission.publicId, module: permission.module, action: permission.action, description: permission.description, created_at: permission.createdAt })) });
}));

module.exports = { rolesRouter };
