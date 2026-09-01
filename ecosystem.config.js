module.exports = {
  apps: [
    {
      name: "task_management_api",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      node_args: "--max_old_space_size=512",

      env: {
        NODE_ENV: "development",
        PORT: 5440,
        PUBLIC_APP_ORIGIN: "http://localhost:4440",
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 5440,
        PUBLIC_APP_ORIGIN: process.env.PUBLIC_APP_ORIGIN,
        TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS || 1,
      },

      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "task_management_web",
      script: "cmd.exe",
      args: "/c npm --prefix client run start",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      node_args: "--max_old_space_size=512",

      env: {
        NODE_ENV: "development",
        CLIENT_PORT: 4440,
        NEXT_PUBLIC_API_URL: "http://localhost:5440/api",
      },

      env_production: {
        NODE_ENV: "production",
        CLIENT_PORT: 4440,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      },

      error_file: "./logs/frontend-err.log",
      out_file: "./logs/frontend-out.log",
      log_file: "./logs/frontend-combined.log",
      merge_logs: true,
      time: true,
    },
  ],
};
