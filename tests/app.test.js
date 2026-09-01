const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function runAppCheck(pathname, originHeader) {
  const serializedPathname = JSON.stringify(pathname);
  const serializedOrigin = JSON.stringify(originHeader || '');
  const script = `
    const http = require('http');
    const { app } = require('./app');

    const originHeader = ${serializedOrigin};
    const server = http.createServer(app);

    function requestJson(port) {
      return new Promise((resolve, reject) => {
        const headers = { Connection: 'close' };
        if (originHeader) {
          headers.Origin = originHeader;
        }

        const request = http.request({
          host: '127.0.0.1',
          port,
          path: ${serializedPathname},
          method: 'GET',
          headers,
          agent: false,
        }, (response) => {
          let rawBody = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            rawBody += chunk;
          });
          response.on('end', () => {
            console.log(JSON.stringify({
              status: response.statusCode,
              body: rawBody ? JSON.parse(rawBody) : null,
            }));
            server.close(() => process.exit(0));
          });
        });

        request.on('error', reject);
        request.end();
      });
    }

    server.listen(0, '127.0.0.1', async () => {
      try {
        const { port } = server.address();
        await requestJson(port);
      }
      catch (error) {
        console.error(error);
        server.close(() => process.exit(1));
      }
    });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const outputLines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const jsonLine = outputLines.findLast((line) => line.startsWith('{'));
  assert.ok(jsonLine, `Expected JSON output, received: ${result.stdout}`);
  return JSON.parse(jsonLine);
}

test('unknown routes return the shared JSON not-found response', () => {
  const response = runAppCheck('/missing-route');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    error_message: 'Route not found',
  });
});

test('blocked CORS origins return the shared JSON error response', () => {
  // This verifies the real app wiring, including the shared error middleware.
  const response = runAppCheck('/health', 'http://evil.example.com');

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    success: false,
    error_message: 'An error occurred. Please try again.',
  });
});

test('production refuses to start without a strong session secret', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./config/env')"], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PUBLIC_APP_ORIGIN: 'https://tasks.example.com',
      SESSION_SECRET: ''
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SESSION_SECRET must be set to at least 32 characters/);
});

test('production refuses an insecure public application origin', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./config/env')"], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PUBLIC_APP_ORIGIN: 'http://tasks.example.com',
      SESSION_SECRET: 'a-production-session-secret-with-32-characters'
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PUBLIC_APP_ORIGIN must use HTTPS in production/);
});

test('production configures the declared trusted proxy hop count', () => {
  const script = `
    const { app, env, sessionStore } = require('./app');
    console.log(JSON.stringify({
      configured_hops: env.trustProxy,
      express_trust_proxy: app.get('trust proxy')
    }));
    sessionStore.close(() => process.exit(0));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PUBLIC_APP_ORIGIN: 'https://tasks.example.com',
      SESSION_SECRET: 'a-production-session-secret-with-32-characters',
      TRUST_PROXY_HOPS: '2'
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout.trim());
  assert.deepEqual(output, {
    configured_hops: 2,
    express_trust_proxy: 2
  });
});
