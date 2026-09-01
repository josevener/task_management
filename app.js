const express = require('express');
const cors = require('cors');

const { env } = require('./config/env');
const { authRouter } = require('./routes/auth.routes');
const { organizationsRouter } = require('./routes/organizations.routes');
const { workspacesRouter } = require('./routes/workspaces.routes');
const { projectsRouter } = require('./routes/projects.routes');
const { tasksRouter } = require('./routes/tasks.routes');
const { rolesRouter } = require('./routes/roles.routes');
const { notificationsRouter } = require('./routes/notifications.routes');
const { invitationsRouter } = require('./routes/invitations.routes');
const { notFoundHandler } = require('./middleware/not-found');
const { errorHandler } = require('./middleware/error-handler');
const { MariaDbSessionStore } = require('./utils/mariadb-session-store');
const { configureSession } = require('./utils/session-config');

const app = express();

const defaultDevOrigins = [
  'http://localhost:4440',
];

const allowedOrigins = new Set([
  ...env.appOrigins,
  ...(env.nodeEnv !== 'production' ? defaultDevOrigins : []),
]);

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests that don't send an Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json());

const sessionStore = env.nodeEnv === 'production' ? new MariaDbSessionStore(env) : undefined;

configureSession(app, env, sessionStore);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', authRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api', rolesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app, env, sessionStore };
