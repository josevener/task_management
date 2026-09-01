const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');

const { withTestServer } = require('./router-test-utils');
const { configureSession } = require('../utils/session-config');

test('production session cookies survive an HTTPS trusted proxy round trip', async () => {
  const app = express();
  configureSession(app, {
    nodeEnv: 'production',
    sessionSecret: 'a-production-session-secret-with-32-characters',
    trustProxy: 1,
  }, new session.MemoryStore());

  app.post('/test-session', (req, res) => {
    req.session.user_id = 42;
    res.json({ success: true });
  });
  app.get('/test-session', (req, res) => {
    res.json({ success: true, user_id: req.session.user_id || null });
  });

  await withTestServer(app, async (requestJson) => {
    const loginResponse = await requestJson('/test-session', {
      method: 'POST',
      headers: { 'x-forwarded-proto': 'https' },
    });
    const setCookie = loginResponse.headers.get('set-cookie');

    assert.equal(loginResponse.status, 200);
    assert.match(setCookie, /task_management\.sid=/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /HttpOnly/);

    const cookie = setCookie.split(';', 1)[0];
    const authenticatedResponse = await requestJson('/test-session', {
      headers: {
        cookie,
        'x-forwarded-proto': 'https'
      },
    });

    assert.equal(authenticatedResponse.status, 200);
    assert.equal(authenticatedResponse.body.user_id, 42);
  });
});
