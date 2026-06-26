const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function stubModule(relativePath, exports) {
  const resolvedPath = require.resolve(path.join(ROOT_DIR, relativePath));
  const previousEntry = require.cache[resolvedPath];

  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports,
  };

  return () => {
    if (previousEntry) {
      require.cache[resolvedPath] = previousEntry;
      return;
    }

    delete require.cache[resolvedPath];
  };
}

function loadCronJobsWithMocks(mockModules) {
  const restores = Object.entries(mockModules).map(([relativePath, exports]) => (
    stubModule(relativePath, exports)
  ));

  const modulePath = require.resolve(path.join(ROOT_DIR, 'utils/cron-jobs.js'));
  delete require.cache[modulePath];

  const cronJobs = require(modulePath);

  return {
    cronJobs,
    restore() {
      delete require.cache[modulePath];
      restores.reverse().forEach((restore) => restore());
    }
  };
}

test('checkOverdueTasks only considers tasks overdue after the start of the current day', async () => {
  let capturedWhere = null;

  const harness = loadCronJobsWithMocks({
    'config/database.js': {
      prisma: {
        task: {
          async findMany({ where }) {
            capturedWhere = where;
            return [];
          }
        },
        notification: {
          async create() {
            throw new Error('notification.create should not be called in this scenario');
          }
        }
      }
    },
    'utils/sse-manager.js': {
      broadcastToUser() {}
    }
  });

  try {
    const now = new Date(2026, 5, 26, 15, 30, 0, 0);
    await harness.cronJobs.checkOverdueTasks(now);

    assert.ok(capturedWhere);
    assert.equal(capturedWhere.dueDate.lt.getFullYear(), 2026);
    assert.equal(capturedWhere.dueDate.lt.getMonth(), 5);
    assert.equal(capturedWhere.dueDate.lt.getDate(), 26);
    assert.equal(capturedWhere.dueDate.lt.getHours(), 0);
    assert.equal(capturedWhere.dueDate.lt.getMinutes(), 0);
    assert.equal(capturedWhere.dueDate.lt.getSeconds(), 0);
    assert.equal(capturedWhere.dueDate.lt.getMilliseconds(), 0);
  }
  finally {
    harness.restore();
  }
});
