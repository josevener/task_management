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
        async findFirst(args) {
          if (args.where.id === 2) {
            return { id: 2, workspaceId: 4, isSystemRole: false };
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
    const response = await requestJson('/workspaces/wsp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/roles/2', {
      method: 'DELETE',
      body: { fallback_role_id: 99 },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.fallback_role_id, 'Fallback role does not belong to this workspace');
  });

  routerHarness.restore();
});
