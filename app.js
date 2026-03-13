const express = require('express');
const cors = require('cors');
const session = require('express-session');

const { env } = require('./config/env');
const { authRouter } = require('./routes/auth.routes');
const { organizationsRouter } = require('./routes/organizations.routes');
const { workspacesRouter } = require('./routes/workspaces.routes');
const { projectsRouter } = require('./routes/projects.routes');
const { tasksRouter } = require('./routes/tasks.routes');
const { rolesRouter } = require('./routes/roles.routes');
const { notificationsRouter } = require('./routes/notifications.routes');
const { notFoundHandler } = require('./middleware/not-found');
const { errorHandler } = require('./middleware/error-handler');

const app = express();

app.use(cors({
  origin: env.appOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(session({
  name: 'task_management.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', authRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', rolesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app, env };
