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

test('member updates reject a role from another workspace', async () => {
  const databaseMock = {
    prisma: {
      workspaceMember: {
        async findUnique() {
          return { workspaceId: 9, userId: 15, roleObj: { name: 'Member' } };
        }
      },
      role: {
        async findFirst() {
          return null;
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
      body: { role_id: 99 },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.role_id, 'The selected role does not belong to this workspace');
  });

  routerHarness.restore();
});

test('member invitations use the workspace Member role and ignore client-controlled role data', async () => {
  const sentMessages = [];
  const createdInvitations = [];
  const databaseMock = {
    prisma: {
      user: {
        async findUnique() {
          return null;
        }
      },
      workspaceMember: {
        async count() {
          return 0;
        }
      },
      workspaceInvitation: {
        async count() { return 0; },
      },
      workspace: {
        async findFirst() {
          return { id: 4, name: 'Workspace A', roles: [{ id: 8, name: 'Member' }] };
        }
      },
      async $transaction(callback) {
        return callback({
          workspaceInvitation: {
            async findUnique() {
              return null;
            },
            async create(args) {
              createdInvitations.push(args.data);
              return { ...args.data, id: 50 };
            }
          },
          activityLog: { async create() { return {}; } },
        });
      }
    }
  };

  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
    'utils/mailer.js': { async sendMail(message) { sentMessages.push(message); return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/4/members', {
      method: 'POST',
      body: { email: 'invitee@example.com', role: '99' },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.invitation.status, 'sent');
    assert.equal(createdInvitations.length, 1);
    assert.equal(createdInvitations[0].roleId, 8);
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].html, /Accept invitation/);
    assert.match(sentMessages[0].text, /expires in 48 hours/);
  });

  routerHarness.restore();
});

test('member invitations require the workspace invite permission', async () => {
  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': { prisma: {} },
    'middleware/auth.js': createWorkspaceAuthMock(async () => false),
    'utils/mailer.js': { async sendMail() { return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/4/members', {
      method: 'POST',
      body: { email: 'invitee@example.com' },
    });

    assert.equal(response.status, 403);
    assert.match(response.body.error_message, /permission/i);
  });

  routerHarness.restore();
});

test('member invitations repair a missing default Member role for a legacy workspace', async () => {
  const createdRoles = [];
  const createdInvitations = [];
  const tx = {
    role: {
      async findFirst() { return null; },
      async create(args) {
        createdRoles.push(args.data);
        return { id: 77, ...args.data };
      },
    },
    permission: {
      async upsert() { return {}; },
      async findMany() { return []; },
    },
    rolePermission: {
      async createMany() { return { count: 0 }; },
    },
    workspaceInvitation: {
      async findUnique() { return null; },
      async create(args) {
        createdInvitations.push(args.data);
        return { id: 88, ...args.data };
      },
    },
    activityLog: { async create() { return {}; } },
  };
  const databaseMock = {
    prisma: {
      workspace: {
        async findFirst() {
          return { id: 4, name: 'Legacy Workspace', roles: [] };
        },
      },
      user: {
        async findUnique() { return null; },
      },
      workspaceInvitation: {
        async count() { return 0; },
      },
      async $transaction(callback) { return callback(tx); },
    },
  };

  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
    'utils/mailer.js': { async sendMail() { return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/4/members', {
      method: 'POST',
      body: { email: 'legacy-invitee@example.com' },
    });

    assert.equal(response.status, 201);
    assert.equal(createdRoles.length, 1);
    assert.equal(createdRoles[0].name, 'Member');
    assert.equal(createdRoles[0].isSystemRole, true);
    assert.equal(createdInvitations[0].roleId, 77);
  });

  routerHarness.restore();
});

test('delivery failure revokes the committed invitation and returns a retryable error', async () => {
  const writes = [];
  const transactionMocks = [
    {
      workspaceInvitation: {
        async findUnique() { return null; },
        async create(args) { return { id: 71, ...args.data }; },
      },
      activityLog: { async create() { return {}; } },
    },
    {
      workspaceInvitation: {
        async updateMany(args) { writes.push(args); return { count: 1 }; },
      },
      activityLog: { async create() { return {}; } },
    },
  ];
  const databaseMock = {
    prisma: {
      user: { async findUnique() { return null; } },
      workspaceMember: { async count() { return 0; } },
      workspaceInvitation: { async count() { return 0; } },
      workspace: { async findFirst() { return { id: 4, name: 'Workspace A', roles: [{ id: 8, name: 'Member' }] }; } },
      async $transaction(callback) { return callback(transactionMocks.shift()); },
    },
  };
  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
    'utils/mailer.js': { async sendMail() { throw Object.assign(new Error('SMTP unavailable'), { code: 'ECONNREFUSED' }); } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/4/members', { method: 'POST', body: { email: 'invitee@example.com' } });
    assert.equal(response.status, 503);
    assert.match(response.body.error_message, /could not be delivered/i);
    assert.equal(writes.length, 1);
    assert.ok(writes[0].data.revokedAt instanceof Date);
  });

  routerHarness.restore();
});

test('concurrent invitation writes retry a serialization conflict instead of returning a unique constraint error', async () => {
  let attempts = 0;
  const tx = {
    workspaceInvitation: {
      async findUnique() { return null; },
      async create(args) { return { id: 72, ...args.data }; },
    },
    activityLog: { async create() { return {}; } },
  };
  const databaseMock = {
    prisma: {
      user: { async findUnique() { return null; } },
      workspaceMember: { async count() { return 0; } },
      workspaceInvitation: { async count() { return 0; } },
      workspace: { async findFirst() { return { id: 4, name: 'Workspace A', roles: [{ id: 8, name: 'Member' }] }; } },
      async $transaction(callback, options) {
        attempts += 1;
        assert.equal(options.isolationLevel, 'Serializable');
        if (attempts === 1) throw Object.assign(new Error('Write conflict'), { code: 'P2034' });
        return callback(tx);
      },
    },
  };
  const routerHarness = loadRouterApp('routes/workspaces.routes.js', 'workspacesRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createWorkspaceAuthMock(async () => true),
    'utils/mailer.js': { async sendMail() { return true; } },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/4/members', { method: 'POST', body: { email: 'invitee@example.com' } });
    assert.equal(response.status, 201);
    assert.equal(attempts, 2);
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
