const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const appRoot = '/home/spmb-sandbox/apps/gymbro/current';
const envFile = path.join(os.homedir(), '.config/gymbro/backend.env');
const fileEnv = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const index = line.indexOf('=');
    if (index < 1) throw new Error('Invalid Gymbro environment file');
    return [line.slice(0, index), line.slice(index + 1)];
  }));

module.exports = {
  apps: [
    {
      name: 'gymbro-api',
      script: path.join(appRoot, 'backend/gymbro-api'),
      cwd: appRoot,
      autorestart: true,
      max_memory_restart: '512M',
      time: true,
      env: {
        ...fileEnv,
        GYMBRO_HTTP_ADDR: '127.0.0.1:4120',
        GYMBRO_PUBLIC_URL: 'https://gymbro.spmbbanjarkab.web.id',
        GYMBRO_API_PUBLIC_URL: 'https://gymbro-backend.spmbbanjarkab.web.id',
        GYMBRO_API_ONLY: 'true',
      },
    },
    {
      name: 'gymbro-web',
      script: path.join(appRoot, 'frontend/scripts/start-dist.mjs'),
      interpreter: process.execPath,
      cwd: appRoot,
      autorestart: true,
      max_memory_restart: '256M',
      time: true,
      env: { GYMBRO_FRONTEND_ADDR: '127.0.0.1:4121', GYMBRO_WEB_DIR: path.join(appRoot, 'frontend/dist') },
    },
  ],
};
