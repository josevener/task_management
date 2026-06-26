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
    prisma: {
      organization: {
        async findUnique({ where }) {
          if (where.id === 1) {
            return { ownerId: 5 };
          }
          return null;
        },
        async update({ where, data }) {
          updatedOrganizations.push(data);
          return {
            id: 1,
            name: data.name || 'Updated Org',
            slug: data.slug || 'updated-org',
            logoUrl: data.logoUrl || null,
            subscriptionTier: data.subscriptionTier || 'free',
            timezone: data.timezone || null,
            defaultLanguage: data.defaultLanguage || null,
            dateFormat: data.dateFormat || null,
            timeFormat: data.timeFormat || null,
            subscriptionStatus: data.subscriptionStatus || 'active',
            ownerId: 5,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z')
          };
        }
      }
    }
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
