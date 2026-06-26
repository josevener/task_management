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
    async query(sql) {
      if (sql.includes('FROM organizations o') && sql.includes('o.is_active = TRUE')) {
        return [{ id: 3 }];
      }

      if (sql.includes('FROM organizations o') && sql.includes(`p.action = 'workspaces:create'`)) {
        return [];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction() {
      throw new Error('withTransaction should not be called');
    },
    async getExistingColumns() {
      return new Set();
    },
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
    async query(sql) {
      if (sql.includes('FROM workspace_members wm') && sql.includes('WHERE wm.id = ?')) {
        return [{
          workspace_id: 9,
          user_id: 15,
          role_name: 'Member',
          is_system_role: 0,
        }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction() {
      throw new Error('withTransaction should not be called');
    },
    async getExistingColumns() {
      return new Set();
    },
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
  const executedSql = [];

  const databaseMock = {
    async query(sql) {
      if (sql.includes('FROM workspace_members wm') && sql.includes('WHERE wm.id = ?')) {
        return [{
          workspace_id: 4,
          user_id: 25,
          role_name: 'Member',
          is_system_role: 0,
        }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction(callback) {
      const connection = {
        async execute(sql) {
          executedSql.push(sql);
          return [{ affectedRows: 1 }];
        },
      };

      return callback(connection);
    },
    async getExistingColumns() {
      return new Set();
    },
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
    assert.ok(executedSql.some((sql) => sql.includes('DELETE pm')));
    assert.ok(executedSql.some((sql) => sql.includes('DELETE FROM workspace_members')));
  });

  routerHarness.restore();
});
