const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRouterApp, withTestServer } = require('./router-test-utils');

function createAuthMiddlewareMock() {
  return {
    attachCurrentUser(req, _res, next) {
      req.currentUser = null;
      next();
    },
    requireAuth(req, res, next) {
      if (!req.currentUser) {
        res.status(401).json({ success: false, error_message: 'Authentication required' });
        return;
      }

      next();
    },
  };
}

test('registration cleans up the pending user when email delivery fails', async () => {
  const state = {
    users: [],
    tokens: [],
    nextUserId: 1,
  };

  const databaseMock = {
    async query(sql, params = []) {
      if (sql.includes('SELECT id FROM users WHERE email = ?')) {
        return state.users.filter((user) => user.email === params[0]).map((user) => ({ id: user.id }));
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async withTransaction(callback) {
      const connection = {
        async execute(sql, params = []) {
          if (sql.includes('INSERT INTO users')) {
            state.users.push({
              id: state.nextUserId,
              email: params[0],
              is_active: false,
              email_verified_at: null,
            });

            return [{ insertId: state.nextUserId++ }];
          }

          if (sql.includes('INSERT INTO email_verification_tokens')) {
            state.tokens.push({ email: params[0], token: params[1] });
            return [{ insertId: state.tokens.length }];
          }

          if (sql.includes('FROM users') && sql.includes('is_active = FALSE')) {
            const pendingUser = state.users.find((user) => user.email === params[0] && !user.is_active);
            return [[pendingUser ? { id: pendingUser.id } : undefined].filter(Boolean)];
          }

          if (sql.includes('FROM workspace_members')) {
            return [[]];
          }

          if (sql.includes('DELETE FROM email_verification_tokens')) {
            state.tokens = state.tokens.filter((token) => token.email !== params[0]);
            return [{ affectedRows: 1 }];
          }

          if (sql.includes('DELETE FROM users WHERE id = ?')) {
            state.users = state.users.filter((user) => user.id !== params[0]);
            return [{ affectedRows: 1 }];
          }

          throw new Error(`Unexpected execute: ${sql}`);
        },
      };

      return callback(connection);
    },
  };

  const routerHarness = loadRouterApp('routes/auth.routes.js', 'authRouter', {
    'config/database.js': databaseMock,
    'middleware/auth.js': createAuthMiddlewareMock(),
    'utils/mailer.js': {
      async sendMail() {
        throw new Error('SMTP unavailable');
      },
    },
  });

  await withTestServer(routerHarness.app, async (requestJson) => {
    const response = await requestJson('/register', {
      method: 'POST',
      body: {
        email: 'new.user@example.com',
        password: 'strongpass123',
        first_name: 'New',
        last_name: 'User',
      },
    });

    assert.equal(response.status, 500);
    assert.equal(state.users.length, 0);
    assert.equal(state.tokens.length, 0);
  });

  routerHarness.restore();
});
