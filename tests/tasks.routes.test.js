const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

test('task parent updates reject a task from another project', async () => {
  const databaseMock = {
    prisma: {
      async $transaction(callback, options) {
        assert.equal(options.isolationLevel, 'Serializable');
        return callback(this);
      },
      task: {
        async findFirst(args) {
          if (args.where.projectId) {
            return null;
          }
          return {
            id: 1,
            projectId: 20,
            assigneeId: null,
            status: 'todo',
            project: { workspaceId: 4, name: 'Project A' }
          };
        }
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
    },
    async checkPermission() {
      return true;
    }
  };

  const routerHarness = loadRouterApp('routes/tasks.routes.js', 'tasksRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/sse-manager.js': { broadcastToUser() {} },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/1', {
      method: 'PATCH',
      body: { parent_task_id: 99 },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.parent_task_id, 'Parent task must belong to the same project');
  });

  routerHarness.restore();
});

test('task parent updates reject circular task hierarchies', async () => {
  const databaseMock = {
    prisma: {
      async $transaction(callback, options) {
        assert.equal(options.isolationLevel, 'Serializable');
        return callback(this);
      },
      task: {
        async findFirst(args) {
          if (!args.where.projectId) {
            return {
              id: 1,
              projectId: 20,
              assigneeId: null,
              status: 'todo',
              project: { workspaceId: 4, name: 'Project A' }
            };
          }
          if (args.where.id === 99) {
            return { id: 99, parentTaskId: 1 };
          }
          return { id: 1, parentTaskId: null };
        }
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
    },
    async checkPermission() {
      return true;
    }
  };

  const routerHarness = loadRouterApp('routes/tasks.routes.js', 'tasksRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/sse-manager.js': { broadcastToUser() {} },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/1', {
      method: 'PATCH',
      body: { parent_task_id: 99 },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.parent_task_id, 'Parent task cannot create a circular hierarchy');
  });

  routerHarness.restore();
});

test('task parent updates reject partially numeric identifiers before opening a transaction', async () => {
  let transactionStarted = false;
  const databaseMock = {
    prisma: {
      async $transaction() {
        transactionStarted = true;
      },
      task: {
        async findFirst() {
          return {
            id: 1,
            projectId: 20,
            assigneeId: null,
            status: 'todo',
            project: { workspaceId: 4, name: 'Project A' }
          };
        }
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
    },
    async checkPermission() {
      return true;
    }
  };

  const routerHarness = loadRouterApp('routes/tasks.routes.js', 'tasksRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/sse-manager.js': { broadcastToUser() {} },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/1', {
      method: 'PATCH',
      body: { parent_task_id: '99-invalid' },
    });

    assert.equal(response.status, 422);
    assert.equal(transactionStarted, false);
  });

  routerHarness.restore();
});

test('task parent updates revalidate hierarchy after a concurrent write conflict', async () => {
  let transactionAttempts = 0;
  const databaseMock = {
    prisma: {
      async $transaction(callback, options) {
        transactionAttempts += 1;
        assert.equal(options.isolationLevel, 'Serializable');

        if (transactionAttempts === 1) {
          const error = new Error('concurrent hierarchy update');
          error.code = 'P2034';
          throw error;
        }

        return callback({
          task: {
            async findFirst(args) {
              if (args.where.id === 99) {
                return { id: 99, parentTaskId: 1 };
              }
              return { id: 1, parentTaskId: null };
            }
          }
        });
      },
      task: {
        async findFirst() {
          return {
            id: 1,
            projectId: 20,
            assigneeId: null,
            status: 'todo',
            project: { workspaceId: 4, name: 'Project A' }
          };
        }
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
    },
    async checkPermission() {
      return true;
    }
  };

  const routerHarness = loadRouterApp('routes/tasks.routes.js', 'tasksRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': authMock,
    'utils/sse-manager.js': { broadcastToUser() {} },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/1', {
      method: 'PATCH',
      body: { parent_task_id: 99 },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.parent_task_id, 'Parent task cannot create a circular hierarchy');
    assert.equal(transactionAttempts, 2);
  });

  routerHarness.restore();
});
