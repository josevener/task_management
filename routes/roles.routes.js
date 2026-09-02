const express = require('express');
const { prisma } = require('../config/database');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { publicIdParam, resolveInternalId } = require('../utils/public-id');
const { getActorRolePolicy, canGrantPermissionActions } = require('../utils/role-policy');
const { runSerializableTransaction } = require('../utils/serializable-transaction');
const { createRbacNotification, broadcastRbacNotification } = require('../utils/rbac-notifications');

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
  id: role.publicId, public_id: role.publicId, workspace_public_id: role.workspace?.publicId,
  name: role.name, description: role.description, is_system_role: Boolean(role.isSystemRole), default_user_count: role._count?.members,
  created_at: role.createdAt, updated_at: role.updatedAt,
});
async function hasRolePermission(client, workspaceId, userId, actions) {
  return (await client.workspaceMember.count({ where: { workspaceId: Number(workspaceId), userId: Number(userId), roleObj: { rolePermissions: { some: { permission: { action: { in: actions } } } } } } })) > 0;
}
async function requireRolePermission(res, workspaceId, userId, actions, message) {
  if (await hasRolePermission(prisma, workspaceId, userId, actions)) return true;
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
async function recordRoleActivity(tx, { workspaceId, userId, activityType, rolePublicId, metadata = {} }) {
  await tx.activityLog.create({
    data: {
      userId,
      workspaceId: Number(workspaceId),
      activityType,
      description: 'Workspace role policy updated',
      metadata: JSON.stringify({ role_public_id: rolePublicId, ...metadata }),
    },
  });
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
  let role;
  let notificationEvent;
  try {
    role = await runSerializableTransaction(prisma, async (tx) => {
      if (!await hasRolePermission(tx, workspaceId, req.currentUser.id, ['roles:create', 'roles:manage'])) { const error = new Error('You do not have permission to create roles'); error.statusCode = 403; throw error; }
      if (await tx.role.findFirst({ where: { workspaceId: Number(workspaceId), name: { equals: normalizedName } }, select: { id: true } })) { const error = new Error('A role with this name already exists in the workspace'); error.validationErrors = { name: error.message }; throw error; }
      const created = await tx.role.create({ data: { workspaceId: Number(workspaceId), name: normalizedName, description: typeof description === 'string' && description.trim() ? description.trim() : null, isSystemRole: false }, select: roleSelect() });
      await recordRoleActivity(tx, { workspaceId, userId: req.currentUser.id, activityType: 'workspace_role_created', rolePublicId: created.publicId });
      notificationEvent = await createRbacNotification(tx, { userId: req.currentUser.id, workspaceId, workspacePublicId: created.workspace.publicId, rolePublicId: created.publicId, type: 'workspace_role_created', title: 'Role created', message: `The ${created.name} role was created.` });
      return created;
    });
  } catch (error) { if (error.validationErrors) return sendValidationError(res, error.validationErrors); if (error.statusCode) return sendError(res, error.message, error.statusCode); throw error; }
  broadcastRbacNotification(notificationEvent);
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
    let notificationEvent;
    const duplicate = await runSerializableTransaction(prisma, async (tx) => {
      const sourceInTransaction = await tx.role.findFirst({ where: { id: source.id, workspaceId: Number(workspaceId), isSystemRole: false }, include: { rolePermissions: { include: { permission: { select: { id: true, action: true } } } } } });
      if (!sourceInTransaction) { const error = new Error('Role not found'); error.statusCode = 404; throw error; }
      if (!await hasRolePermission(tx, workspaceId, req.currentUser.id, ['roles:create', 'roles:manage'])) { const error = new Error('You do not have permission to create roles'); error.statusCode = 403; throw error; }
      const policyInTransaction = await getActorRolePolicy(tx, workspaceId, req.currentUser.id);
      if (!canGrantPermissionActions(policyInTransaction, sourceInTransaction.rolePermissions.map(({ permission }) => permission.action))) { const error = new Error('You cannot duplicate a role with permissions you do not hold'); error.statusCode = 403; throw error; }
      if (await tx.role.findFirst({ where: { workspaceId: Number(workspaceId), name: { equals: normalizedName } }, select: { id: true } })) { const error = new Error('A role with this name already exists in the workspace'); error.validationErrors = { name: error.message }; throw error; }
      const role = await tx.role.create({ data: { workspaceId: Number(workspaceId), name: normalizedName, description: typeof description === 'string' ? description.trim() || null : source.description, isSystemRole: false }, select: roleSelect() });
      if (sourceInTransaction.rolePermissions.length) await tx.rolePermission.createMany({ data: sourceInTransaction.rolePermissions.map(({ permission }) => ({ roleId: role.id, permissionId: permission.id })) });
      await recordRoleActivity(tx, { workspaceId, userId: req.currentUser.id, activityType: 'workspace_role_duplicated', rolePublicId: role.publicId, metadata: { source_role_public_id: source.publicId } });
      notificationEvent = await createRbacNotification(tx, { userId: req.currentUser.id, workspaceId, workspacePublicId: source.workspace.publicId, rolePublicId: role.publicId, type: 'workspace_role_duplicated', title: 'Role duplicated', message: `The ${role.name} role was duplicated.` });
      return role;
    });
    broadcastRbacNotification(notificationEvent);
    return sendSuccess(res, { role: mapRole(duplicate) }, 201);
  } catch (error) { if (error.validationErrors) return sendValidationError(res, error.validationErrors); if (error.statusCode) return sendError(res, error.message, error.statusCode); throw error; }
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
  let notificationEvent;
  let updated;
  try {
    updated = await runSerializableTransaction(prisma, async (tx) => {
      const roleInTransaction = await tx.role.findFirst({ where: { id: role.id, workspaceId: Number(workspaceId), isSystemRole: false }, select: { id: true, publicId: true, name: true } });
      if (!roleInTransaction) { const error = new Error('Role not found'); error.statusCode = 404; throw error; }
      if (!await hasRolePermission(tx, workspaceId, req.currentUser.id, ['roles:edit', 'roles:manage'])) { const error = new Error('You do not have permission to edit roles'); error.statusCode = 403; throw error; }
      if (finalName.toLowerCase() !== roleInTransaction.name.toLowerCase() && await tx.role.findFirst({ where: { workspaceId: Number(workspaceId), name: { equals: finalName }, id: { not: roleInTransaction.id } }, select: { id: true } })) { const error = new Error('A role with this name already exists in the workspace'); error.validationErrors = { name: error.message }; throw error; }
      const changed = await tx.role.update({ where: { id: roleInTransaction.id }, data: { name: finalName, description: description === undefined ? undefined : (typeof description === 'string' && description.trim() ? description.trim() : null) }, select: roleSelect() });
      await recordRoleActivity(tx, { workspaceId, userId: req.currentUser.id, activityType: 'workspace_role_updated', rolePublicId: changed.publicId });
      notificationEvent = await createRbacNotification(tx, { userId: req.currentUser.id, workspaceId, workspacePublicId: role.workspace.publicId, rolePublicId: changed.publicId, type: 'workspace_role_updated', title: 'Role updated', message: `The ${changed.name} role was updated.` });
      return changed;
    });
  } catch (error) { if (error.validationErrors) return sendValidationError(res, error.validationErrors); if (error.statusCode) return sendError(res, error.message, error.statusCode); throw error; }
  broadcastRbacNotification(notificationEvent);
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
  let notificationEvent;
  try {
    await runSerializableTransaction(prisma, async (tx) => {
    const roleInTransaction = await tx.role.findFirst({ where: { id: role.id, workspaceId: Number(workspaceId), isSystemRole: false }, select: { id: true, publicId: true, _count: { select: { members: true } } } });
    if (!roleInTransaction) { const error = new Error('Role not found'); error.statusCode = 404; throw error; }
    if (!await hasRolePermission(tx, workspaceId, req.currentUser.id, ['roles:delete', 'roles:manage'])) { const error = new Error('You do not have permission to delete roles'); error.statusCode = 403; throw error; }
    let fallbackInTransaction;
    if (fallbackRoleId) {
      fallbackInTransaction = await tx.role.findFirst({ where: { id: fallbackRoleId, workspaceId: Number(workspaceId), NOT: { id: roleInTransaction.id } }, select: { id: true, name: true, rolePermissions: { select: { permission: { select: { action: true } } } } } });
      const policyInTransaction = await getActorRolePolicy(tx, workspaceId, req.currentUser.id);
      if (!fallbackInTransaction || !canGrantPermissionActions(policyInTransaction, fallbackInTransaction.rolePermissions.map(({ permission }) => permission.action))) { const error = new Error('You cannot reassign members to a role with permissions you do not hold'); error.statusCode = 403; throw error; }
    }
    if (roleInTransaction._count.members > 0 && !fallbackRoleId) { const error = new Error('Select a fallback role before deleting a role with assigned members'); error.validationErrors = { fallback_role_public_id: error.message }; throw error; }
    if (fallbackRoleId) await tx.workspaceMember.updateMany({ where: { workspaceId: Number(workspaceId), roleId: roleInTransaction.id }, data: { roleId: fallbackRoleId, role: fallbackInTransaction.name } });
    await tx.role.delete({ where: { id: roleInTransaction.id } });
    await recordRoleActivity(tx, { workspaceId, userId: req.currentUser.id, activityType: 'workspace_role_deleted', rolePublicId: roleInTransaction.publicId, metadata: fallbackRoleId ? { fallback_role_public_id } : {} });
    notificationEvent = await createRbacNotification(tx, { userId: req.currentUser.id, workspaceId, workspacePublicId: role.workspace.publicId, rolePublicId: roleInTransaction.publicId, type: 'workspace_role_deleted', title: 'Role deleted', message: 'A workspace role was deleted.' });
    });
  } catch (error) { if (error.validationErrors) return sendValidationError(res, error.validationErrors); if (error.statusCode) return sendError(res, error.message, error.statusCode); throw error; }
  broadcastRbacNotification(notificationEvent);
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
  let notificationEvent;
  try {
    await runSerializableTransaction(prisma, async (tx) => {
    const roleInTransaction = await tx.role.findFirst({ where: { id: role.id, workspaceId: Number(workspaceId), isSystemRole: false }, select: { id: true, publicId: true } });
    if (!roleInTransaction) { const error = new Error('Role not found'); error.statusCode = 404; throw error; }
    if (!await hasRolePermission(tx, workspaceId, req.currentUser.id, ['roles:create', 'roles:edit', 'roles:manage'])) { const error = new Error('You do not have permission to manage role permissions'); error.statusCode = 403; throw error; }
    const policyInTransaction = await getActorRolePolicy(tx, workspaceId, req.currentUser.id);
    if (!canGrantPermissionActions(policyInTransaction, resolved.permissions.map((permission) => permission.action))) { const error = new Error('You cannot grant permissions you do not hold'); error.statusCode = 403; throw error; }
    await tx.rolePermission.deleteMany({ where: { roleId: roleInTransaction.id } });
    if (resolved.permissions.length) await tx.rolePermission.createMany({ data: resolved.permissions.map((permission) => ({ roleId: roleInTransaction.id, permissionId: permission.id })) });
    await recordRoleActivity(tx, { workspaceId, userId: req.currentUser.id, activityType: 'workspace_role_permissions_updated', rolePublicId: roleInTransaction.publicId, metadata: { permission_public_ids: resolved.permissions.map((permission) => permission.publicId) } });
    notificationEvent = await createRbacNotification(tx, { userId: req.currentUser.id, workspaceId, workspacePublicId: role.workspace.publicId, rolePublicId: roleInTransaction.publicId, type: 'workspace_role_permissions_updated', title: 'Role permissions updated', message: 'Workspace role permissions were updated.' });
    });
  } catch (error) { if (error.validationErrors) return sendValidationError(res, error.validationErrors); if (error.statusCode) return sendError(res, error.message, error.statusCode); throw error; }
  broadcastRbacNotification(notificationEvent);
  return sendSuccess(res, { message: 'Permissions updated successfully' });
}));

rolesRouter.get('/permissions', asyncHandler(async (_req, res) => {
  const permissions = await prisma.permission.findMany({ select: { publicId: true, module: true, action: true, description: true, createdAt: true }, orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  return sendSuccess(res, { permissions: permissions.map((permission) => ({ id: permission.publicId, public_id: permission.publicId, module: permission.module, action: permission.action, description: permission.description, created_at: permission.createdAt })) });
}));

module.exports = { rolesRouter };
