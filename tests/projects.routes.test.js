const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

function createWorkspaceAuthMock(checkPermissionImpl = async () => false) {
  return {
    attachCurrentUser(req, _res, next) {
      req.currentUser = {
        id: 7,
        email: 'member@example.com',
        first_name: 'Workspace',
        last_name: 'Member',
      };
      next();
    },
    requireAuth(req, _res, next) {
      next();
    },
    checkPermission: checkPermissionImpl,
  };
}

test('project updates require current workspace membership even for former project owners', async () => {
  const databaseMock = {
    async query(sql) {
      if (sql.includes('FROM projects p') && sql.includes('INNER JOIN workspace_members wm')) {
        return [];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction() {
      throw new Error('withTransaction should not be called');
    },
  };

  const routerHarness = loadRouterApp('routes/projects.routes.js', 'projectsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/123', {
      method: 'PATCH',
      body: { name: 'Renamed project' },
    });

    assert.equal(response.status, 404);
    assert.equal(response.body.error_message, 'Project not found');
  });

  routerHarness.restore();
});
