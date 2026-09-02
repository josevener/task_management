const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { MariaDbSessionStore } = require('../utils/mariadb-session-store');
const { withMariaDbTestDatabase } = require('./mariadb-integration-utils');

function invokeStoreMethod(store, method, ...args) {
  return new Promise((resolve, reject) => {
    store[method](...args, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

test('session migration supports persistence and expiration cleanup in MariaDB', async (t) => {
  await withMariaDbTestDatabase(t, async ({ connection, dbConfig }) => {
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '..', 'prisma', 'migrations', '20260828000000_add_sessions_table', 'migration.sql'),
      'utf8'
    );
    await connection.query(migrationSql);
    await connection.query('ALTER TABLE sessions ADD COLUMN public_id VARCHAR(40) NOT NULL, ADD UNIQUE INDEX sessions_public_id_key (public_id)');

    const store = new MariaDbSessionStore({
      dbHost: dbConfig.host,
      dbPort: dbConfig.port,
      dbUser: dbConfig.user,
      dbPassword: dbConfig.password,
      dbName: dbConfig.database,
    }, { cleanupIntervalMs: 0 });

    try {
      const sessionData = {
        user_id: 42,
        cookie: { expires: new Date(Date.now() + 60_000).toISOString() }
      };

      await invokeStoreMethod(store, 'set', 'integration-session', sessionData);
      assert.deepEqual(await invokeStoreMethod(store, 'get', 'integration-session'), sessionData);

      await connection.query(
        'UPDATE sessions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE sid = ?',
        ['integration-session']
      );
      assert.equal(await invokeStoreMethod(store, 'pruneExpiredSessions'), 1);
      assert.equal(await invokeStoreMethod(store, 'get', 'integration-session'), null);
    }
    finally {
      await invokeStoreMethod(store, 'close');
    }
  });
});
