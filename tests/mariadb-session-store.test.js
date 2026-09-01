const test = require('node:test');
const assert = require('node:assert/strict');

const { MariaDbSessionStore } = require('../utils/mariadb-session-store');

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

test('MariaDB session store persists, reads, touches, and destroys sessions', async () => {
  const queries = [];
  const sessionData = { user_id: 7, cookie: { expires: new Date(Date.now() + 60_000).toISOString() } };
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT')) {
        return [{ data: JSON.stringify(sessionData) }];
      }
      return { affectedRows: 1 };
    },
    async end() {}
  };
  const store = new MariaDbSessionStore({}, { pool, cleanupIntervalMs: 0 });

  await invokeStoreMethod(store, 'set', 'session-1', sessionData);
  assert.deepEqual(await invokeStoreMethod(store, 'get', 'session-1'), sessionData);
  await invokeStoreMethod(store, 'touch', 'session-1', sessionData);
  await invokeStoreMethod(store, 'destroy', 'session-1');
  await invokeStoreMethod(store, 'close');

  assert.match(queries[0].sql, /^INSERT INTO sessions/);
  assert.match(queries[1].sql, /^SELECT data FROM sessions/);
  assert.match(queries[2].sql, /^UPDATE sessions SET expires_at/);
  assert.match(queries[3].sql, /^DELETE FROM sessions WHERE sid/);
});

test('MariaDB session store removes expired sessions', async () => {
  const pool = {
    async query(sql) {
      assert.equal(sql, 'DELETE FROM sessions WHERE expires_at <= NOW()');
      return { affectedRows: 4 };
    },
    async end() {}
  };
  const store = new MariaDbSessionStore({}, { pool, cleanupIntervalMs: 0 });

  const removedCount = await invokeStoreMethod(store, 'pruneExpiredSessions');
  await invokeStoreMethod(store, 'close');

  assert.equal(removedCount, 4);
});

test('MariaDB session store forwards database failures to callbacks', async () => {
  const expectedError = new Error('database unavailable');
  const pool = {
    async query() {
      throw expectedError;
    },
    async end() {}
  };
  const store = new MariaDbSessionStore({}, { pool, cleanupIntervalMs: 0 });

  await assert.rejects(invokeStoreMethod(store, 'get', 'session-1'), expectedError);
  await invokeStoreMethod(store, 'close');
});
