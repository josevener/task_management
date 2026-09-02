const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

const authMock = {
  attachCurrentUser(req, _res, next) {
    req.currentUser = {
      id: 8,
      email: 'member@example.com',
      first_name: 'Member',
      last_name: 'User',
    };
    next();
  },
  requireAuth(req, _res, next) {
    next();
  },
};

test('role list requires explicit role view permission', async () => {
  const databaseMock = {
    prisma: {
      workspaceMember: {
        async count() {
          return 0; // Mock count to 0 (user has no permission)
        }
      },
      workspace: {
        async findUnique() {
          return { id: 2 };
        }
      }
    }
  };

  const routerHarness = loadRouterApp('routes/roles.routes.js', 'rolesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/workspaces/wsp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/roles');

    assert.equal(response.status, 403);
    assert.equal(response.body.error_message, 'You do not have permission to view roles');
  });

  routerHarness.restore();
});

test('role deletion rejects a fallback role from another workspace', async () => {
  const databaseMock = {
    prisma: {
      workspaceMember: {
        async count() {
          return 1;
        }
      },
      workspace: {
        async findUnique() {
          return { id: 4 };
        }
      },
      role: {
        async findUnique(args) {
          return args.where.publicId.startsWith('rol_b') ? { id: 99 } : { id: 2 };
        },
        async findFirst(args) {
          if (args.where.id === 2) {
            return { id: 2, publicId: 'rol_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', workspaceId: 4, isSystemRole: false, _count: { members: 0 } };
          }
          return null;
        }
      }
    }
  };

  const routerHarness = loadRouterApp('routes/roles.routes.js', 'rolesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/workspaces/wsp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/roles/rol_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
      method: 'DELETE',
      body: { fallback_role_public_id: 'rol_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.fallback_role_public_id, 'Fallback role must be a different role in this workspace');
  });

  routerHarness.restore();
});

test('role creation repeats its permission check inside the serializable transaction', async () => {
  let roleCreated = false;
  const databaseMock = {
    prisma: {
      workspace: { async findUnique() { return { id: 4 }; } },
      workspaceMember: {
        async count() { return 1; },
      },
      async $transaction(callback, options) {
        assert.equal(options.isolationLevel, 'Serializable');
        return callback({
          workspaceMember: { async count() { return 0; } },
          role: {
            async findFirst() { return null; },
            async create() { roleCreated = true; },
          },
        });
      },
    },
  };

  const routerHarness = loadRouterApp('routes/roles.routes.js', 'rolesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/rbac-notifications.js': { async createRbacNotification() { throw new Error('must not notify a rejected change'); }, broadcastRbacNotification() {} },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/workspaces/wsp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/roles', {
      method: 'POST', body: { name: 'Contributor' },
    });
    assert.equal(response.status, 403);
    assert.match(response.body.error_message, /permission to create roles/i);
    assert.equal(roleCreated, false);
  });

  routerHarness.restore();
});

test('role deletion synchronizes the denormalized member role during fallback reassignment', async () => {
  const memberUpdates = [];
  const targetRoleId = 'rol_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const fallbackRoleId = 'rol_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const databaseMock = {
    prisma: {
      workspace: { async findUnique() { return { id: 4 }; } },
      workspaceMember: {
        async count() { return 1; },
        async findFirst() { return { roleObj: { name: 'Admin', isSystemRole: true, rolePermissions: [] } }; },
      },
      role: {
        async findUnique(args) { return { id: args.where.publicId === targetRoleId ? 2 : 3 }; },
        async findFirst(args) {
          if (args.where.id === 2) return { id: 2, publicId: targetRoleId, workspaceId: 4, name: 'Legacy role', isSystemRole: false, workspace: { publicId: 'wsp_cccccccccccccccccccccccccccccccc' }, _count: { members: 1 } };
          return { id: 3, name: 'Member', rolePermissions: [{ permission: { action: 'roles:delete' } }] };
        },
      },
      async $transaction(callback) {
        return callback({
          workspaceMember: {
            async count() { return 1; },
            async findFirst() { return { roleObj: { name: 'Admin', isSystemRole: true, rolePermissions: [] } }; },
            async updateMany(args) { memberUpdates.push(args); return { count: 1 }; },
          },
          role: {
            async findFirst(args) {
              if (args.where.id === 2) return { id: 2, publicId: targetRoleId, _count: { members: 1 } };
              return { id: 3, name: 'Member', rolePermissions: [{ permission: { action: 'roles:delete' } }] };
            },
            async delete() { return {}; },
          },
          activityLog: { async create() { return {}; } },
        });
      },
    },
  };

  const routerHarness = loadRouterApp('routes/roles.routes.js', 'rolesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/rbac-notifications.js': { async createRbacNotification() { return { userId: 8, payload: {} }; }, broadcastRbacNotification() {} },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson(`/workspaces/wsp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/roles/${targetRoleId}`, {
      method: 'DELETE', body: { fallback_role_public_id: fallbackRoleId },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(memberUpdates[0].data, { roleId: 3, role: 'Member' });
  });

  routerHarness.restore();
});
