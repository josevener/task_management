const test = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSIONS, createRoleWithPermissions, getPermissionActionsForRole } = require('../utils/rbac');

function createTransactionDouble() {
  const state = {
    nextPermissionId: 1,
    nextRoleId: 1,
    permissions: [],
    roles: [],
    rolePermissions: [],
  };

  return {
    state,
    tx: {
      permission: {
        async upsert({ where, create }) {
          const existing = state.permissions.find((permission) => permission.action === where.action);
          if (existing) {
            return existing;
          }

          const newPermission = {
            id: state.nextPermissionId++,
            ...create,
          };
          state.permissions.push(newPermission);
          return newPermission;
        },
        async findMany() {
          return state.permissions.map((permission) => ({
            id: permission.id,
            action: permission.action,
          }));
        }
      },
      role: {
        async create({ data }) {
          const newRole = {
            id: state.nextRoleId++,
            ...data,
          };
          state.roles.push(newRole);
          return newRole;
        }
      },
      rolePermission: {
        async createMany({ data }) {
          for (const rolePermission of data) {
            const exists = state.rolePermissions.some((entry) => (
              entry.roleId === rolePermission.roleId &&
              entry.permissionId === rolePermission.permissionId
            ));

            if (!exists) {
              state.rolePermissions.push(rolePermission);
            }
          }

          return { count: data.length };
        }
      }
    }
  };
}

test('createRoleWithPermissions seeds the permission catalogue before granting admin access', async () => {
  const { state, tx } = createTransactionDouble();

  const role = await createRoleWithPermissions(tx, {
    workspaceId: 9,
    name: 'Admin',
    description: 'Full administrative access',
    isSystemRole: true
  });

  assert.equal(role.name, 'Admin');
  assert.equal(state.permissions.length, PERMISSIONS.length);
  assert.equal(state.rolePermissions.length, PERMISSIONS.length);
});

test('member role permissions stay scoped to the intended subset', async () => {
  const { state, tx } = createTransactionDouble();

  const role = await createRoleWithPermissions(tx, {
    workspaceId: 9,
    name: 'Member',
    description: 'Can create and manage tasks.',
    isSystemRole: true
  });

  const permissionsById = new Map(state.permissions.map((permission) => [permission.id, permission.action]));
  const assignedActions = state.rolePermissions
    .filter((rolePermission) => rolePermission.roleId === role.id)
    .map((rolePermission) => permissionsById.get(rolePermission.permissionId))
    .sort();

  const expectedActions = [...getPermissionActionsForRole('Member')].sort();

  assert.deepEqual(assignedActions, expectedActions);
  assert.ok(!assignedActions.includes('tasks:delete'));
  assert.ok(assignedActions.includes('projects:create'));
  assert.ok(assignedActions.includes('tasks:view'));
});
