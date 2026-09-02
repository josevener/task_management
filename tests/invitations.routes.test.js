const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

const VALID_TOKEN = 'a'.repeat(64);

function invitation(overrides = {}) {
  return {
    id: 10,
    workspaceId: 4,
    email: 'invitee@example.com',
    roleId: 8,
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    workspace: { id: 4, name: 'Workspace A', isActive: true },
    role: { id: 8, name: 'Member', workspaceId: 4 },
    invitedBy: { firstName: 'Admin', lastName: 'User', isActive: true },
    ...overrides,
  };
}

function authMock(currentUser) {
  return {
    attachCurrentUser(req, _res, next) {
      req.currentUser = currentUser;
      req.session = {};
      next();
    },
  };
}

test('an authenticated existing user accepts a valid invitation once with the stored role', async () => {
  const createdMemberships = [];
  const existingUser = {
    id: 25,
    email: 'invitee@example.com',
    firstName: 'Existing',
    lastName: 'User',
    avatarUrl: null,
    createdAt: new Date(),
  };
  const databaseMock = {
    prisma: {
      workspaceInvitation: {
        async findUnique() { return invitation(); },
      },
      user: {
        async findUnique() { return existingUser; },
      },
      async $transaction(callback) {
        return callback({
          workspaceInvitation: {
            async updateMany() { return { count: 1 }; },
          },
          user: {
            async findUnique() { return existingUser; },
          },
          workspaceMember: {
            async findFirst() { return null; },
            async findUnique() { return null; },
            async create(args) {
              createdMemberships.push(args.data);
              return { id: 99, ...args.data };
            },
          },
          activityLog: { async create() { return {}; } },
        });
      },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock({ id: 25, email: 'invitee@example.com' }),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, { method: 'POST', body: {} });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.workspace_id, 4);
    assert.deepEqual(createdMemberships[0], {
      workspaceId: 4,
      userId: 25,
      roleId: 8,
      role: 'Member',
    });
  });

  harness.restore();
});

test('an existing user cannot accept an invitation into a different organization', async () => {
  let invitationClaimed = false;
  const existingUser = { id: 25, email: 'invitee@example.com', firstName: 'Existing', lastName: 'User' };
  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': {
      prisma: {
        workspaceInvitation: { async findUnique() { return invitation({ workspace: { id: 4, name: 'Workspace A', isActive: true, organizationId: 2 } }); } },
        user: { async findUnique() { return existingUser; } },
        async $transaction(callback) {
          return callback({
            user: { async findUnique() { return existingUser; } },
            workspaceMember: { async findFirst() { return { id: 7 }; } },
            workspaceInvitation: { async updateMany() { invitationClaimed = true; return { count: 1 }; } },
          });
        },
      },
    },
    'middleware/auth.js': authMock({ id: 25, email: 'invitee@example.com' }),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, { method: 'POST', body: {} });
    assert.equal(response.status, 409);
    assert.match(response.body.error_message, /only one organization/i);
    assert.equal(invitationClaimed, false);
  });

  harness.restore();
});

test('an expired invitation is rejected without starting a transaction', async () => {
  let transactionStarted = false;
  const databaseMock = {
    prisma: {
      workspaceInvitation: {
        async findUnique() {
          return invitation({ expiresAt: new Date(Date.now() - 1_000) });
        },
      },
      async $transaction() {
        transactionStarted = true;
      },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock(null),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}`);
    assert.equal(response.status, 410);
    assert.match(response.body.error_message, /expired/i);
    assert.equal(transactionStarted, false);
  });

  harness.restore();
});

test('an inactive inviter makes the invitation unavailable without starting a transaction', async () => {
  let transactionStarted = false;
  const databaseMock = {
    prisma: {
      workspaceInvitation: {
        async findUnique() {
          return invitation({ invitedBy: { firstName: 'Former', lastName: 'Admin', isActive: false } });
        },
      },
      activityLog: { async create() { return {}; } },
      async $transaction() {
        transactionStarted = true;
      },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock(null),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, { method: 'POST', body: {} });
    assert.equal(response.status, 409);
    assert.match(response.body.error_message, /can no longer be accepted/i);
    assert.equal(transactionStarted, false);
  });

  harness.restore();
});

test('an invitee whose account already exists is directed to authenticate without consuming the invitation', async () => {
  let transactionStarted = false;
  const databaseMock = {
    prisma: {
      workspaceInvitation: { async findUnique() { return invitation(); } },
      user: { async findUnique() { return { id: 25, email: 'invitee@example.com' }; } },
      async $transaction() { transactionStarted = true; },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock(null),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, { method: 'POST', body: {} });
    assert.equal(response.status, 401);
    assert.equal(response.body.errors.requires_auth, true);
    assert.equal(response.body.errors.email, 'invitee@example.com');
    assert.equal(transactionStarted, false);
  });

  harness.restore();
});

test('a new recipient supplies their own profile and creates an active account atomically', async () => {
  const createdUsers = [];
  const createdMemberships = [];
  const databaseMock = {
    prisma: {
      workspaceInvitation: {
        async findUnique() { return invitation({ email: 'new@example.com' }); },
      },
      user: {
        async findUnique() { return null; },
      },
      async $transaction(callback) {
        return callback({
          workspaceInvitation: {
            async updateMany() { return { count: 1 }; },
          },
          user: {
            async findUnique() { return null; },
            async create(args) {
              createdUsers.push(args.data);
              return { id: 44, avatarUrl: null, createdAt: new Date(), ...args.data };
            },
          },
          workspaceMember: {
            async findFirst() { return null; },
            async findUnique() { return null; },
            async create(args) {
              createdMemberships.push(args.data);
              return { id: 101, ...args.data };
            },
          },
          activityLog: { async create() { return {}; } },
        });
      },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock(null),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, {
      method: 'POST',
      body: {
        first_name: 'New',
        last_name: 'Person',
        password: 'secure-pass',
        password_confirmation: 'secure-pass',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(createdUsers.length, 1);
    assert.equal(createdUsers[0].email, 'new@example.com');
    assert.equal(createdUsers[0].firstName, 'New');
    assert.equal(createdUsers[0].isActive, true);
    assert.ok(createdUsers[0].emailVerifiedAt instanceof Date);
    assert.notEqual(createdUsers[0].passwordHash, 'secure-pass');
    assert.deepEqual(createdMemberships[0], {
      workspaceId: 4,
      userId: 44,
      roleId: 8,
      role: 'Member',
    });
  });

  harness.restore();
});

test('the wrong authenticated account cannot accept an invitation', async () => {
  let transactionStarted = false;
  const databaseMock = {
    prisma: {
      workspaceInvitation: {
        async findUnique() { return invitation(); },
      },
      user: {
        async findUnique() { return { id: 25, email: 'invitee@example.com' }; },
      },
      async $transaction() {
        transactionStarted = true;
      },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock({ id: 30, email: 'someone-else@example.com' }),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, { method: 'POST', body: {} });
    assert.equal(response.status, 403);
    assert.match(response.body.error_message, /different account/i);
    assert.equal(transactionStarted, false);
  });

  harness.restore();
});

test('a signed-in different account cannot create an account from a new-recipient invitation', async () => {
  let transactionStarted = false;
  const databaseMock = {
    prisma: {
      workspaceInvitation: { async findUnique() { return invitation({ email: 'new@example.com' }); } },
      user: { async findUnique() { return null; } },
      async $transaction() { transactionStarted = true; },
    },
  };

  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock({ id: 30, email: 'someone-else@example.com' }),
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}/accept`, {
      method: 'POST',
      body: { first_name: 'New', last_name: 'Person', password: 'secure-pass', password_confirmation: 'secure-pass' },
    });
    assert.equal(response.status, 403);
    assert.match(response.body.error_message, /different account/i);
    assert.equal(transactionStarted, false);
  });

  harness.restore();
});

test('an authorized workspace member can revoke a pending invitation', async () => {
  const auditEntries = [];
  const databaseMock = {
    prisma: {
      workspaceInvitation: { async findUnique() { return invitation(); } },
      async $transaction(callback) {
        return callback({
          workspaceInvitation: { async updateMany() { return { count: 1 }; } },
          activityLog: { async create(args) { auditEntries.push(args.data); return {}; } },
        });
      },
    },
  };
  const harness = loadRouterApp('routes/invitations.routes.js', 'invitationsRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': {
      ...authMock({ id: 25, email: 'admin@example.com' }),
      async checkPermission() { return true; },
    },
  });

  await withTestServer(harness.app, async (requestJson) => {
    const response = await requestJson(`/${VALID_TOKEN}`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    assert.equal(auditEntries[0].activityType, 'workspace_invitation_revoked');
  });

  harness.restore();
});
