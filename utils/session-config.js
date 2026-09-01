const session = require('express-session');

function configureSession(app, env, store) {
  if (env.trustProxy) {
    // Trust only the configured number of proxy hops when interpreting forwarded HTTPS.
    app.set('trust proxy', env.trustProxy);
  }

  app.use(session({
    name: 'task_management.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    // Production sessions must survive restarts and work across application instances.
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }));
}

module.exports = { configureSession };
