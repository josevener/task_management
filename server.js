const { app, env } = require('./app');

const { startCronJobs } = require('./utils/cron-jobs');

app.listen(env.port, () => {
  // Keep startup output minimal so local debugging stays readable.
  console.log(`Backend listening on http://localhost:${env.port}`);
  startCronJobs();
});
