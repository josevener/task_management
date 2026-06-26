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
    prisma: {
      user: {
        async findFirst({ where }) {
          const user = state.users.find((u) => u.email === where.email);
          return user ? { id: user.id } : null;
        }
      },
      async $transaction(callback) {
        const tx = {
          user: {
            async create({ data }) {
              const newUser = {
                id: state.nextUserId++,
                email: data.email,
                isActive: false,
                emailVerifiedAt: null,
              };
              state.users.push(newUser);
              return newUser;
            },
            async findFirst({ where }) {
              const user = state.users.find((u) => u.email === where.email && !u.isActive);
              return user ? { id: user.id } : null;
            },
            async delete({ where }) {
              state.users = state.users.filter((u) => u.id !== where.id);
              return { id: where.id };
            }
          },
          emailVerificationToken: {
            async create({ data }) {
              const token = { email: data.email, token: data.token };
              state.tokens.push(token);
              return token;
            },
            async deleteMany({ where }) {
              state.tokens = state.tokens.filter((t) => t.email !== where.email);
              return { count: 1 };
            }
          },
          workspaceMember: {
            async findFirst() {
              return null;
            }
          }
        };
        return callback(tx);
      }
    }
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
