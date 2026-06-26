const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

function createWorkspaceAuthMock(checkPermissionImpl) {
  return {
    attachCurrentUser(req, _res, next) {
      req.currentUser = {
        id: 11,
        email: 'admin@example.com',
        first_name: 'Admin',
        last_name: 'User',
      };
      next();
    },
    requireAuth(req, _res, next) {
      next();
    },
    checkPermission: checkPermissionImpl,
  };
}

test('workspace creation is denied when the user lacks create permission in the organization', async () => {
  const databaseMock = {
    prisma: {
      organization: {
        async count() {
          return 1; // has access to the organization
        },
        async findUnique() {
          return { ownerId: 99 }; // not the owner
        }
      },
      workspaceMember: {
        async count() {
          return 0; // lacks create permission
        }
      }
    }
  };

  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => false),
    'utils/mailer.js': { async sendMail() { return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/', {
      method: 'POST',
      body: {
        organization_id: 3,
        name: 'Ops Workspace',
      },
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.error_message, 'You do not have permission to create workspaces in this organization');
  });

  routerHarness.restore();
});

test('member updates reject global profile changes from the workspace screen', async () => {
  const databaseMock = {
    prisma: {
      workspaceMember: {
        async findUnique() {
          return {
            workspaceId: 9,
            userId: 15,
            roleObj: { name: 'Member', isSystemRole: false }
          };
        }
      }
    }
  };

  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
    'utils/mailer.js': { async sendMail() { return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/members/22', {
      method: 'PUT',
      body: {
        first_name: 'Changed',
      },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.profile, 'Profile updates must be managed from the user account settings.');
  });

  routerHarness.restore();
});

test('removing a workspace member also clears their project memberships in that workspace', async () => {
  const executedCalls = [];

  const databaseMock = {
    prisma: {
      workspaceMember: {
        async findUnique() {
          return {
            workspaceId: 4,
            userId: 25,
            roleObj: { name: 'Member', isSystemRole: false }
          };
        }
      },
      async $transaction(callback) {
        const txMock = {
          projectMember: {
            async deleteMany(args) {
              executedCalls.push({ type: 'deleteManyProjectMembers', args });
              return { count: 1 };
            }
          },
          workspaceMember: {
            async delete(args) {
              executedCalls.push({ type: 'deleteWorkspaceMember', args });
              return { id: args.where.id };
            }
          }
        };
        return callback(txMock);
      }
    }
  };

  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
    'utils/mailer.js': { async sendMail() { return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/members/50', {
      method: 'DELETE',
    });

    assert.equal(response.status, 200);
    assert.ok(executedCalls.some((call) => call.type === 'deleteManyProjectMembers'));
    assert.ok(executedCalls.some((call) => call.type === 'deleteWorkspaceMember'));
  });

  routerHarness.restore();
});
