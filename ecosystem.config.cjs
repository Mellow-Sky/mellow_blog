const path = require('node:path');

module.exports = {
  apps: [{
    name: 'mellow-blog',
    cwd: __dirname,
    script: path.join(__dirname, 'scripts', 'start-production.cjs'),
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    restart_delay: 3000,
    watch: false,
    time: true,
    env: { NODE_ENV: 'production' },
  }],
};
