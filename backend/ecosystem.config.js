module.exports = {
  apps: [
    {
      name: 'ocr-portal-backend',
      script: 'dist/index.js',
      cwd: __dirname,

      // Restart policy
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '1G',

      // Logging — aligns with project standard (10MB rotate, 5 retained)
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,

      // Environment defaults (overridden per deploy target)
      env_development: {
        ENVIRONMENT: 'development',
        NODE_ENV: 'development',
      },
      env_qa: {
        ENVIRONMENT: 'qa',
        NODE_ENV: 'production',
      },
      env_production: {
        ENVIRONMENT: 'production',
        NODE_ENV: 'production',
      },
    },
  ],
};
