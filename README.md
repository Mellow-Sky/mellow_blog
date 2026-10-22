# mellow-blog

基于 Next.js App Router、React、TypeScript、Tailwind CSS、Motion 与 SQLite 的博客框架。仓库仅包含源码、通用静态资源、测试与部署配置；首次运行自动创建空数据库，文章、评论、账户和上传文件由使用者自行添加。

## 功能

- Markdown 与受限制的 MDX、代码高亮、文章与独立页面、分类标签、搜索和 RSS。
- 后台管理发布、草稿、私密文章、评论审核与回复、媒体上传、备份及站点设置。
- 可配置导航、首页、头像、背景、主题色、明暗模式与列表布局。
- 可选音乐播放、Spotify 嵌入与追番展示，按需在后台配置。
- SQLite 本地持久化，无需另行安装数据库服务器。

## 本地运行

使用 **Node.js 22** 和 npm：

```bash
git clone https://github.com/Mellow-Sky/mellow_blog.git mellow-blog
cd mellow-blog
npm ci
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，后台地址为 [http://localhost:3000/admin](http://localhost:3000/admin)。数据库与表会自动初始化，无需导入数据或执行迁移命令。

首次进入后台时，设置 3–64 字符的用户名与 12–256 字符的密码。开发环境通过 `localhost`、`127.0.0.1` 或 IPv6 回环地址访问时，部署设置令牌可留空；远程访问及生产环境必须配置并输入 `ADMIN_SETUP_TOKEN`。

如需自定义环境变量，将 `.env.example` 复制为 `.env.local` 后填写。`better-sqlite3` 为原生模块；没有适用的预编译包时，安装环境需要 Python 3 与 C/C++ 编译工具。应在目标操作系统上运行 `npm ci`。

## 配置与个性化

站点标题、作者、头像、首页、导航、页脚、评论和可选集成均在后台设置。上线后将“站点地址”填写为正式 HTTPS 地址，以生成正确的文章分享、RSS 与站点地图链接。图片上传支持 PNG、JPG、GIF、WebP、AVIF，音频支持 MP3、OGG、WAV；单文件上限为 20 MB。

| 环境变量 | 说明 |
| --- | --- |
| `DATABASE_PATH` | SQLite 文件路径，建议使用绝对路径；默认 `data/blog.db`。 |
| `ADMIN_SETUP_TOKEN` | 生产环境首次创建管理员所需的随机长令牌；管理员创建后可移除。 |
| `SESSION_SECRET` | 可选会话签名密钥；留空时自动生成并保存在数据库。修改会使现有登录失效。 |
| `TRUST_PROXY` | 仅在可信反向代理覆盖协议与客户端 IP 头时设为 `1`；默认 `0`。 |
| `PORT` | 服务端口，默认 `3000`。 |
| `BLOG_HOSTNAME` | 生产启动脚本的监听地址，默认 `127.0.0.1`。 |

开发服务读取 `.env.local` 等 Next.js 环境文件；生产启动脚本读取项目根目录的 `.env.production`。示例文件可提交，实际环境文件与密钥不可提交。

## 验证与生产运行

```bash
npm run typecheck
npm test
npm run build
npm run deploy:prepare
npm run start:production
```

`npm test` 使用临时数据库。生产启动前，将 `.env.production.example` 复制为 `.env.production`，并将 `ADMIN_SETUP_TOKEN` 占位值替换为随机令牌：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`deploy:prepare` 准备 standalone 静态资源，并将运行目录的 `public` 连接到项目目录。每次构建后都需执行。生产后台依赖 HTTPS Cookie；通过 HTTPS 域名打开 `/admin` 完成首次设置。

此应用需要持续运行的 Node.js 进程和可写的持久磁盘。使用 Nginx 等可信反向代理、HTTPS 和单实例 PM2，详细步骤见 [Linux + 宝塔部署指南](docs/DEPLOY-BAOTA.md)。数据库和环境文件不能放入可公开访问的静态目录。

## 数据、备份与更新

`data/`、`public/uploads/`、实际环境文件、依赖和构建产物均不进入 Git。克隆仓库可获得空白博客框架；线上更新时保留服务器已有的数据库、上传文件与环境配置。

完整备份应包含数据库或后台导出的 JSON、`public/uploads/`，以及单独安全保存的环境配置。JSON 包含评论邮箱等私有信息，不包含媒体文件本体，也不包含管理员密码及登录会话。复制 SQLite 文件前应停止服务，或使用 SQLite 一致性备份；运行中直接复制单个 `blog.db` 可能遗漏 WAL 中的数据。

恢复 JSON 时，先停止服务、保存现有数据并恢复上传文件，再执行：

```bash
NODE_ENV=production npm run backup:restore -- /绝对路径/backup.json --confirm
```

恢复会先备份当前数据库，再替换文章、评论、分类、媒体记录与站点设置；现有管理员和会话保留。在空白数据库恢复内容后仍需创建管理员。

忘记管理员密码时，在服务器安全设置 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD` 环境变量后执行：

```bash
NODE_ENV=production npm run admin:reset -- --confirm
```

重置会使旧登录失效，不影响文章和评论。密钥、密码、数据库、备份和私人媒体应保存在仓库之外。
