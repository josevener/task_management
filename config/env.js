const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

function resolvePublicAppOrigin() {
  return process.env.PUBLIC_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:4440';
}

const appOrigin = resolvePublicAppOrigin();
const nodeEnv = process.env.NODE_ENV || 'development';
const sessionSecret = process.env.SESSION_SECRET;

// A known fallback secret would let anyone forge production session cookies.
if (nodeEnv === 'production' && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET must be set to at least 32 characters in production');
}

// Production authentication requires HTTPS because session cookies are secure-only.
if (nodeEnv === 'production' && !appOrigin.startsWith('https://')) {
  throw new Error('PUBLIC_APP_ORIGIN must use HTTPS in production');
}

const trustProxy = nodeEnv === 'production'
  ? Number(process.env.TRUST_PROXY_HOPS || 1)
  : false;

if (nodeEnv === 'production' && (!Number.isInteger(trustProxy) || trustProxy < 1)) {
  throw new Error('TRUST_PROXY_HOPS must be a positive integer in production');
}

const env = {
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  appOrigin,
  appOrigins: [appOrigin],
  trustProxy,
  sessionSecret: sessionSecret || 'development-only-session-secret',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbName: process.env.DB_NAME || 'task_management',
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || '12345678',
};

module.exports = { env };
