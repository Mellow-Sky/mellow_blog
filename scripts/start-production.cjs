const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const environment = path.join(root, '.env.production');
try {
  if (fs.existsSync(environment)) {
    if (typeof process.loadEnvFile !== 'function') throw new Error('请使用 Node.js 22 运行生产服务。');
    process.loadEnvFile(environment);
  }
  process.env.NODE_ENV = 'production';
  process.env.HOSTNAME = process.env.BLOG_HOSTNAME || '127.0.0.1';
  process.env.PORT = process.env.PORT || '3000';
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1 到 65535 的整数。');
  process.env.DATABASE_PATH = path.resolve(root, process.env.DATABASE_PATH || 'data/blog.db');
  if (process.env.ADMIN_SETUP_TOKEN === 'CHANGE_ME_TO_A_RANDOM_TOKEN') throw new Error('请先把 .env.production 中的管理员设置令牌替换为随机值。');
  if (!fs.existsSync(process.env.DATABASE_PATH) && !process.env.ADMIN_SETUP_TOKEN) throw new Error('首次启动空白博客前，请先配置 ADMIN_SETUP_TOKEN。');
  fs.mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true, mode: 0o700 });
  const runtime = path.join(root, '.next', 'standalone');
  const server = path.join(runtime, 'server.js');
  if (!fs.existsSync(server) || !fs.existsSync(path.join(runtime, '.next', 'static'))) throw new Error('生产资源尚未准备，请先运行 npm run build 和 npm run deploy:prepare。');
  if (fs.realpathSync(path.join(runtime, 'public')) !== fs.realpathSync(path.join(root, 'public'))) throw new Error('生产媒体目录未连接到持久化 public，请先运行 npm run deploy:prepare。');
  require(server);
} catch (error) {
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
}
