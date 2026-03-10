const { app, env } = require('./app');

app.listen(env.port, () => {
  // Keep startup output minimal so local debugging stays readable.
  console.log(`Backend listening on http://localhost:${env.port}`);
});
