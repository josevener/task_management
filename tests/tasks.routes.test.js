const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

test('task updates use an integer task ID when loading tags', async () => {
  let requestedTagTaskId;
  const databaseMock = {
    prisma: {
      task: {
        async findFirst() {
          return {
            id: 1,
            title: 'Original task',
            projectId: 20,
            assigneeId: null,
            status: 'todo',
            project: { workspaceId: 4, name: 'Project A' }
          };
        },
        async findUnique(args) {
          if (args.where.publicId) return { id: 1 };
          return {
            id: 1,
            publicId: 'tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            title: 'Updated task',
            projectId: 20,
            parentTaskId: null,
            description: null,
            status: 'todo',
            priority: 'medium',
            assigneeId: null,
            assignedBy: null,
            startDate: null,
            dueDate: null,
            position: 0,
            createdBy: 8,
            createdAt: new Date(),
            updatedAt: new Date(),
            assignee: null,
            creator: null,
            assignedByUser: null,
            project: { name: 'Project A' }
          };
        }
      },
      taskTagAssignment: {
        async findMany({ where }) {
          requestedTagTaskId = where.taskId;
          return [];
        }
      },
      async $transaction(callback, options) {
        assert.equal(options.isolationLevel, 'Serializable');
        return callback({
          task: { async update() {} },
          taskTagAssignment: { async deleteMany() {} },
          taskTag: { async findFirst() { return null; } },
          activityLog: { async create() {} },
          notification: { async create() {} },
          workspace: { async findUnique() { return null; } }
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
    const response = await requestJson('/tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
      method: 'PATCH',
      body: { title: 'Updated task' },
    });

    assert.equal(response.status, 200);
    assert.equal(requestedTagTaskId, 1);
    assert.equal(typeof requestedTagTaskId, 'number');
  });

  routerHarness.restore();
});

test('task parent updates reject a task from another project', async () => {
  const databaseMock = {
    prisma: {
      async $transaction(callback, options) {
        assert.equal(options.isolationLevel, 'Serializable');
        return callback(this);
      },
      task: {
        async findUnique(args) { if (args.where.publicId) return { id: 1 }; return null; },
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
    const response = await requestJson('/tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
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
        async findUnique(args) { if (args.where.publicId) return { id: 1 }; return null; },
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
    const response = await requestJson('/tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
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
        async findUnique(args) { if (args.where.publicId) return { id: 1 }; return null; },
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
    const response = await requestJson('/tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
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
        async findUnique(args) { if (args.where.publicId) return { id: 1 }; return null; },
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
    const response = await requestJson('/tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
      method: 'PATCH',
      body: { parent_task_id: 99 },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.errors.parent_task_id, 'Parent task cannot create a circular hierarchy');
    assert.equal(transactionAttempts, 2);
  });

  routerHarness.restore();
});
