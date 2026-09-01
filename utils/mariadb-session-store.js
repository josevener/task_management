const session = require('express-session');
const mariadb = require('mariadb');

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

class MariaDbSessionStore extends session.Store {
  constructor(env, options = {}) {
    super();
    this.pool = options.pool || mariadb.createPool({
      host: env.dbHost,
      port: env.dbPort,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
      connectionLimit: 5
    });

    const cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    this.cleanupTimer = cleanupIntervalMs > 0
      ? setInterval(() => {
        // Cleanup is best-effort; a transient failure must not terminate the API process.
        this.pruneExpiredSessions((error) => {
          if (error) {
            console.error('Failed to prune expired sessions:', error);
          }
        });
      }, cleanupIntervalMs)
      : null;
    this.cleanupTimer?.unref();
  }

  get(sid, callback) {
    this.pool.query('SELECT data FROM sessions WHERE sid = ? AND expires_at > NOW()', [sid])
      .then((rows) => callback(null, rows[0] ? JSON.parse(rows[0].data) : null))
      .catch((error) => callback(error));
  }

  set(sid, sessionData, callback) {
    const expiresAt = new Date(sessionData.cookie?.expires || Date.now() + 7 * 24 * 60 * 60 * 1000);
    this.pool.query(
      'INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)',
      [sid, JSON.stringify(sessionData), expiresAt]
    ).then(() => callback?.()).catch((error) => callback?.(error));
  }

  destroy(sid, callback) {
    this.pool.query('DELETE FROM sessions WHERE sid = ?', [sid])
      .then(() => callback?.()).catch((error) => callback?.(error));
  }

  touch(sid, sessionData, callback) {
    const expiresAt = new Date(sessionData.cookie?.expires || Date.now() + 7 * 24 * 60 * 60 * 1000);
    this.pool.query('UPDATE sessions SET expires_at = ? WHERE sid = ?', [expiresAt, sid])
      .then(() => callback?.()).catch((error) => callback?.(error));
  }

  pruneExpiredSessions(callback) {
    this.pool.query('DELETE FROM sessions WHERE expires_at <= NOW()')
      .then((result) => callback?.(null, Number(result.affectedRows || 0)))
      .catch((error) => callback?.(error));
  }

  close(callback) {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    Promise.resolve(this.pool.end?.())
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}

module.exports = { DEFAULT_CLEANUP_INTERVAL_MS, MariaDbSessionStore };
