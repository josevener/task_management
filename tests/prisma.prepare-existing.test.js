const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function stubMariadbModule(exports) {
  const resolvedPath = require.resolve('mariadb');
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

test('prepareExistingPrismaDb executes every legacy compatibility statement', async () => {
  const executedSql = [];
  let endCalled = false;

  const restoreMariadb = stubMariadbModule({
    async createConnection() {
      return {
        async query(sql) {
          executedSql.push(sql);
        },
        async end() {
          endCalled = true;
        }
      };
    }
  });

  const modulePath = require.resolve(path.join(ROOT_DIR, 'prisma', 'prepare-existing-prisma-db.js'));
  delete require.cache[modulePath];

  try {
    const { LEGACY_PRISMA_COMPATIBILITY_SQL, prepareExistingPrismaDb } = require(modulePath);
    await prepareExistingPrismaDb({ database: 'test_db' });

    assert.deepEqual(executedSql, LEGACY_PRISMA_COMPATIBILITY_SQL);
    assert.equal(endCalled, true);
  }
  finally {
    delete require.cache[modulePath];
    restoreMariadb();
  }
});
