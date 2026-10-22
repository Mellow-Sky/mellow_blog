import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, realpath, rename, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.next', 'standalone');
const publicSource = path.join(root, 'public');
const publicTarget = path.join(runtime, 'public');

async function exists(filename) {
  try { return await lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function verifyUploads(directory, relative = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(relative, item.name);
    const source = path.join(directory, item.name);
    if (item.isDirectory()) { await verifyUploads(source, name); continue; }
    if (!item.isFile()) throw new Error('运行目录内有特殊上传文件，请先备份检查后再准备生产目录。');
    const original = path.join(publicSource, 'uploads', name);
    if (!await exists(original)) throw new Error(`发现只在旧运行目录中的上传文件 uploads/${name}。请先备份并合并到项目 public/uploads 后重试。`);
    const digest = buffer => createHash('sha256').update(buffer).digest('hex');
    if (digest(await readFile(source)) !== digest(await readFile(original))) throw new Error(`上传文件 uploads/${name} 与项目目录不一致，请先备份合并后重试。`);
  }
}

try {
  for (const filename of [path.join(runtime, 'server.js'), path.join(root, '.next', 'static'), publicSource]) {
    if (!await exists(filename)) throw new Error('缺少生产构建或 public 资源。请先执行 npm ci 和 npm run build。');
  }
  await mkdir(path.join(publicSource, 'uploads'), { recursive: true });
  const current = await exists(publicTarget);
  const alreadyLinked = current?.isSymbolicLink() && await realpath(publicTarget).catch(() => '') === await realpath(publicSource);
  if (!alreadyLinked) {
    if (current) {
      const uploads = path.join(publicTarget, 'uploads');
      if (await exists(uploads)) await verifyUploads(uploads);
      const backup = path.join(runtime, `.public-before-link-${Date.now()}`);
      await rename(publicTarget, backup);
      console.log('已保留构建中的 public 副本，原始 public 未改动。');
    }
    await symlink(publicSource, publicTarget, 'dir');
  }
  const staticTarget = path.join(runtime, '.next', 'static');
  if ((await exists(staticTarget))?.isSymbolicLink()) throw new Error('生产 static 目录是已有软链接，请先检查该目录，避免覆盖外部文件。');
  await mkdir(path.dirname(staticTarget), { recursive: true });
  await cp(path.join(root, '.next', 'static'), staticTarget, { recursive: true });
  await mkdir(path.join(runtime, 'scripts'), { recursive: true });
  await cp(path.join(root, 'scripts', 'schema.sql'), path.join(runtime, 'scripts', 'schema.sql'));
  console.log('生产资源已就绪：媒体使用项目 public，数据库由启动脚本固定到项目 data。');
  console.log('请配置 .env.production，再运行 npm run start:production 或使用宝塔 PM2 项目。');
} catch (error) {
  console.error(`生产目录准备失败：${error.message}`);
  process.exitCode = 1;
}
