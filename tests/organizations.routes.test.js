const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

test('organization bootstrap provisions permissions for every default role', async () => {
  const createdRoleNames = [];
  const databaseMock = {
    prisma: {
      workspaceMember: {
        async count() {
          return 0;
        }
      },
      organization: {
        async findUnique() {
          return null;
        }
      },
      async $transaction(callback) {
        return callback({
          organization: {
            async create() {
              return { id: 1, name: 'Acme', slug: 'acme' };
            }
          },
          workspace: {
            async create() {
              return { id: 2, name: 'Acme Workspace', slug: 'acme-workspace', organizationId: 1, colorTheme: 'blue' };
            }
          },
          workspaceMember: {
            async create() {
              return { id: 1 };
            }
          }
        });
      }
    }
  };
  const authMock = {
    attachCurrentUser(req, _res, next) {
      req.currentUser = { id: 8 };
      next();
    },
    requireAuth(_req, _res, next) {
      next();
    }
  };

  const routerHarness = loadRouterApp('routes/organizations.routes.js', 'organizationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/rbac.js': {
      async createRoleWithPermissions(_tx, roleData) {
        createdRoleNames.push(roleData.name);
        return { id: createdRoleNames.length, ...roleData };
      }
    }
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/', {
      method: 'POST',
      body: { name: 'Acme' },
    });

    assert.equal(response.status, 201);
    assert.deepEqual(createdRoleNames, ['Admin', 'Manager', 'Member', 'Guest']);
  });

  routerHarness.restore();
});
