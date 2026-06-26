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
    async query(sql) {
      if (sql.includes('FROM workspace_members wm') && sql.includes('p.action IN')) {
        return [];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction() {
      throw new Error('withTransaction should not be called');
    },
  };

  const routerHarness = loadRouterApp('routes/roles.routes.js', 'rolesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/workspaces/2/roles');

    assert.equal(response.status, 403);
    assert.equal(response.body.error_message, 'You do not have permission to view roles');
  });

  routerHarness.restore();
});
