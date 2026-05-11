module.exports = {
  apps: [
    {
      name: 'selenium-backend',
      script: 'api/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        API_PORT: 3103,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'selenium-frontend',
      script: './server.cjs',
      env: {
        FRONTEND_PORT: 3102,
        NODE_ENV: 'production'
      }
    }
  ]
};
