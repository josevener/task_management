const PERMISSIONS = [
  { module: 'projects', action: 'projects:create', description: 'Create new projects in the workspace' },
  { module: 'projects', action: 'projects:edit', description: 'Edit project details' },
  { module: 'projects', action: 'projects:delete', description: 'Delete projects' },
  { module: 'tasks', action: 'tasks:create', description: 'Create tasks in projects' },
  { module: 'tasks', action: 'tasks:edit', description: 'Edit any task' },
  { module: 'tasks', action: 'tasks:delete', description: 'Delete tasks' },
  { module: 'members', action: 'members:invite', description: 'Invite new members to the workspace' },
  { module: 'members', action: 'members:remove', description: 'Remove members from the workspace' },
  { module: 'members', action: 'members:manage_roles', description: 'Assign and manage roles for members' },
  { module: 'roles', action: 'roles:manage', description: 'Create, edit, and delete custom roles and assign permissions' },
  { module: 'dashboard', action: 'dashboard:view', description: 'View the workspace dashboard' },
  { module: 'workspaces', action: 'workspaces:view', description: 'View the workspace details and list' },
  { module: 'workspaces', action: 'workspaces:create', description: 'Create new workspaces' },
  { module: 'workspaces', action: 'workspaces:edit', description: 'Edit workspace settings' },
  { module: 'workspaces', action: 'workspaces:delete', description: 'Delete the workspace' },
  { module: 'projects', action: 'projects:view', description: 'View projects list and details' },
  { module: 'projects', action: 'projects:import', description: 'Import projects data' },
  { module: 'tasks', action: 'tasks:view', description: 'View tasks list and details' },
  { module: 'tasks', action: 'tasks:import', description: 'Import tasks data' },
  { module: 'members', action: 'members:view', description: 'View the workspace members list' },
  { module: 'roles', action: 'roles:view', description: 'View roles and their permissions' },
  { module: 'roles', action: 'roles:create', description: 'Create new custom roles' },
  { module: 'roles', action: 'roles:edit', description: 'Edit roles and their permissions' },
  { module: 'roles', action: 'roles:delete', description: 'Delete custom roles' },
  { module: 'organizations', action: 'organizations:view', description: 'View organizations list and details' },
  { module: 'organizations', action: 'organizations:create', description: 'Create new organizations' },
  { module: 'organizations', action: 'organizations:edit', description: 'Edit organization settings' },
  { module: 'organizations', action: 'organizations:delete', description: 'Delete organizations' },
  { module: 'settings', action: 'settings:view', description: 'View global or workspace settings' },
  { module: 'settings', action: 'settings:edit', description: 'Edit global or workspace settings' }
];

function getPermissionActionsForRole(roleName) {
  if (roleName === 'Admin') {
    return PERMISSIONS.map((permission) => permission.action);
  }

  if (roleName === 'Manager') {
    return PERMISSIONS
      .filter((permission) => !permission.action.startsWith('roles:') &&
        !permission.action.startsWith('organizations:') &&
        permission.action !== 'workspaces:delete')
      .map((permission) => permission.action);
  }

  if (roleName === 'Member') {
    return PERMISSIONS
      .filter((permission) => permission.action.endsWith(':view') ||
        (permission.action.startsWith('tasks:') && permission.action !== 'tasks:delete') ||
        permission.action === 'projects:create' ||
        permission.action === 'projects:edit')
      .map((permission) => permission.action);
  }

  if (roleName === 'Guest') {
    return PERMISSIONS
      .filter((permission) => permission.action.endsWith(':view'))
      .map((permission) => permission.action);
  }

  return [];
}

async function ensurePermissionsSeeded(tx) {
  // Provision permissions lazily so fresh databases and partially migrated environments
  // always have the RBAC catalogue required by workspace and auth bootstrap flows.
  for (const permission of PERMISSIONS) {
    await tx.permission.upsert({
      where: { action: permission.action },
      update: {},
      create: permission
    });
  }

  return tx.permission.findMany({
    select: { id: true, action: true }
  });
}

async function assignPermissionsToRole(tx, roleId, roleName) {
  const permissions = await ensurePermissionsSeeded(tx);
  const allowedActions = new Set(getPermissionActionsForRole(roleName));
  const selectedPermissions = permissions.filter((permission) => allowedActions.has(permission.action));

  if (selectedPermissions.length === 0) {
    return;
  }

  await tx.rolePermission.createMany({
    data: selectedPermissions.map((permission) => ({
      roleId,
      permissionId: permission.id
    })),
    skipDuplicates: true
  });
}

async function createRoleWithPermissions(tx, roleData) {
  const role = await tx.role.create({
    data: roleData
  });

  await assignPermissionsToRole(tx, role.id, role.name);
  return role;
}

module.exports = {
  PERMISSIONS,
  assignPermissionsToRole,
  createRoleWithPermissions,
  ensurePermissionsSeeded,
  getPermissionActionsForRole,
};
