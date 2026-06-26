const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

const authMock = {
  attachCurrentUser(req, _res, next) {
    req.currentUser = {
      id: 5,
      email: 'owner@example.com',
      first_name: 'Owner',
      last_name: 'User',
    };
    next();
  },
  requireAuth(req, _res, next) {
    next();
  },
};

test('organization edits accept admins with legacy mixed-case Admin roles', async () => {
  const updatedOrganizations = [];

  const databaseMock = {
    async query(sql, params = []) {
      if (sql.includes('FROM organizations o') && sql.includes(`p.action = 'organizations:edit'`)) {
        return [{ id: 1 }];
      }

      if (sql.includes('UPDATE organizations')) {
        updatedOrganizations.push(params);
        return { affectedRows: 1 };
      }

      if (sql.includes('SELECT') && sql.includes('FROM organizations o') && sql.includes('LIMIT 1')) {
        return [{
          id: 1,
          name: 'Updated Org',
          slug: 'updated-org',
          logo_url: null,
          subscription_tier: 'free',
          timezone: null,
          default_language: null,
          date_format: null,
          time_format: null,
          subscription_status: null,
          owner_id: 5,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction() {
      throw new Error('withTransaction should not be called');
    },
    async getExistingColumns() {
      return new Set(['timezone', 'default_language', 'date_format', 'time_format', 'subscription_status', 'owner_id']);
    },
  };

  const routerHarness = loadRouterApp('routes/organizations.routes.js', 'organizationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/1', {
      method: 'PATCH',
      body: { name: 'Updated Org' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.organization.name, 'Updated Org');
    assert.equal(updatedOrganizations.length, 1);
  });

  routerHarness.restore();
});
