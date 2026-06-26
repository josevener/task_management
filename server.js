const { app, env } = require("./app");
const { startCronJobs } = require("./utils/cron-jobs");

function startServer() {
  const port = env.port || process.env.PORT || 5440;

  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);

    try {
      startCronJobs();
    }
    catch (err) {
      console.log(`${new Date().toISOString()} >> Server: Failed to start cron jobs:`, err);
    }
  });
}

startServer();
