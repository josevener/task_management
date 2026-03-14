module.exports = {
  apps: [
    {
      name: 'zentrix-backend',
      script: 'server.js',
      cwd: '.',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8500
      }
    },
    {
      name: 'zentrix-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4500',
      cwd: './client',
      out_file: '../logs/frontend-out.log',
      error_file: '../logs/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
