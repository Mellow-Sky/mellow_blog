# Linux + 宝塔部署指南

使用 Node.js 22、PM2、Nginx 与 HTTPS 部署空白博客。以下项目目录为 `/www/wwwroot/mellow-blog`，域名示例为 `blog.example.com`；请替换为自己的部署配置。SQLite 数据库会自动初始化，无需创建 MySQL 数据库或上传旧数据库、文章及媒体。

## 1. 准备服务器

在宝塔安装 Nginx 与 Node.js / PM2 管理功能，终端和 PM2 均选择 Node.js 22：

```bash
node -v
npm -v
```

将域名 DNS 解析到服务器，安全组与防火墙放行 80、443。Node 服务监听 `127.0.0.1:3000`，由 Nginx 对外提供访问。

## 2. 克隆源码与配置环境

```bash
cd /www/wwwroot
git clone https://github.com/Mellow-Sky/mellow_blog.git mellow-blog
cd mellow-blog
cp .env.production.example .env.production
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

编辑 `.env.production`，将生成的随机令牌填入 `ADMIN_SETUP_TOKEN`：

```dotenv
NODE_ENV=production
DATABASE_PATH=/www/wwwroot/mellow-blog/data/blog.db
BLOG_HOSTNAME=127.0.0.1
PORT=3000
TRUST_PROXY=1
ADMIN_SETUP_TOKEN=填入刚才生成的随机令牌
SESSION_SECRET=
```

`TRUST_PROXY=1` 适用于下文覆盖代理头的可信 Nginx 配置。`SESSION_SECRET` 留空时自动生成并存入私有数据库；若自行设置，更新时保留原值。生产启动脚本自动读取根目录的 `.env.production`。配置文件已被 Git 忽略，勿提交真实令牌或密码。

## 3. 安装与构建

```bash
npm ci
npm run build
npm run deploy:prepare
```

在目标服务器安装依赖和构建；构建需要开发依赖，不要为 `npm ci` 添加 `--omit=dev`。如果原生模块安装提示缺少编译工具，Debian / Ubuntu 可安装 `python3 make g++` 后重试。

`deploy:prepare` 复制 standalone 所需的静态资源与数据库结构文件，并将 standalone 的 `public` 连接到项目根目录的 `public`。每次构建后都需重新执行，以正确访问样式与后台上传文件。

## 4. 设置运行权限与 PM2

假设应用使用宝塔常见的 `www` 用户运行；选择其他用户时，相应替换用户与组：

```bash
mkdir -p data public/uploads .next/standalone/.next/cache
chown -R www:www data public/uploads .next/standalone/.next/cache
chown www:www .env.production
chmod 700 data
chmod 600 .env.production
```

运行用户需要读取源码、构建产物与静态资源，并可写数据库目录、上传目录和图片缓存目录。自定义 `DATABASE_PATH` 时，还需给对应父目录设置相同的数据库写权限。

在宝塔 PM2 管理中使用项目的 `ecosystem.config.cjs`：

| 项目 | 值 |
| --- | --- |
| 名称 | `mellow-blog` |
| 工作目录 | `/www/wwwroot/mellow-blog` |
| 配置文件 | `/www/wwwroot/mellow-blog/ecosystem.config.cjs` |
| 实际启动文件 | `/www/wwwroot/mellow-blog/scripts/start-production.cjs` |
| Node.js | 22 |
| 运行用户 | `www`，与目录权限一致 |
| 模式 / 实例数 | `fork` / `1` |
| 自动重启 / 文件监听 | 开启 / 关闭 |

若面板只支持启动文件，选择 `scripts/start-production.cjs`，工作目录仍为项目根目录。不要把 `ecosystem.config.cjs` 当作普通启动文件运行。启用 PM2 的开机启动与进程恢复功能。

临时排错可先停止 PM2，再在项目目录执行 `npm run start:production`。避免 PM2 与终端同时启动服务。启动后检查：

```bash
curl -I http://127.0.0.1:3000
```

首次启动会创建空白数据库；生产环境尚无管理员时，必须先配置有效的 `ADMIN_SETUP_TOKEN`。

## 5. 配置 HTTPS 与反向代理

在宝塔为正式域名添加 Nginx 站点，使用单独的空目录作为静态根目录。不要公开项目根目录，其中包含数据库和环境配置。申请 SSL 证书并开启 HTTP 跳转 HTTPS，保留证书续签所需的 `.well-known` 配置。

将 `/` 反向代理到 `http://127.0.0.1:3000`，在已有 HTTPS `server` 块中配置：

```nginx
client_max_body_size 21m;

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
}
```

若面板已创建 `location /`，修改已有配置，避免重复。关闭代理缓存，移除会绕过代理的冲突静态文件规则。保存前通过 Nginx 语法检查，再重载服务。

应用根据 `Host` 和协议头校验后台请求来源；此配置覆盖客户端传入的 IP 头，适合启用 `TRUST_PROXY=1`。上传限制为 20 MB，Nginx 的 `21m` 为表单留出空间。

## 6. 创建管理员与验收

打开 `https://blog.example.com/admin`，输入 `.env.production` 中的部署设置令牌，创建 3–64 字符的用户名与 12–256 字符的密码。生产登录 Cookie 需要 HTTPS。创建管理员后可删除 `ADMIN_SETUP_TOKEN` 值并重启 PM2。

在后台设置站点名称、作者、正式 HTTPS 地址与其他个性化选项，然后检查：

- 首页、归档和手机布局可以正常访问。
- 后台可保存草稿、发布文章、上传图片并查看上传结果。
- 文章链接、站点地图和 RSS 使用正确域名。
- 配置音乐或其他可选功能后，页面能正常展示。

在“我的追番”保存 Bangumi Access Token 后，服务会在一分钟内开始首次同步，随后每次完整同步成功后间隔 7 天自动同步。后台会显示下次同步时间，并可点击“立即同步”；手动同步成功也会重新计算这 7 天。同步计划保存在 SQLite 中，PM2 重启后继续执行，到期未执行的任务会在启动后补同步。失败时保留旧收藏，一小时后重试；删除 Token 后停止。保持 PM2 服务运行即可，无需另设宝塔计划任务、系统 cron 或定期打开页面。

后台选择文章封面、站点图标和背景等媒体图片时，可直接点击缩略图选择。

## 7. 更新与备份

数据库、备份、`public/uploads/` 和实际环境文件均被 Git 忽略，不随源码克隆。线上更新保留这些持久数据；不要使用清除忽略文件的命令清理部署目录。

更新前备份数据并在 PM2 停止项目，再执行：

```bash
cd /www/wwwroot/mellow-blog
git pull --ff-only
npm ci
npm run build
npm run deploy:prepare
mkdir -p .next/standalone/.next/cache
chown -R www:www data public/uploads .next/standalone/.next/cache
```

所有命令成功后重启 PM2，检查首页、后台和上传功能。此流程有短暂停机；构建失败时保留数据并检查日志。

完整备份包括数据库或后台导出的 JSON、`public/uploads/` 及单独安全保存的 `.env.production`。JSON 不包含媒体文件本体。复制 SQLite 文件前停止服务并完整保存相关 WAL 状态，或使用 SQLite 一致性备份。JSON 恢复与管理员重置命令见 [README](../README.md)。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 原生模块安装失败 | 确认 Node.js 22、网络和编译工具，在服务器重新安装依赖。 |
| 首次启动提示令牌无效 | 替换 `.env.production` 中的示例令牌，保存后重启，并在后台输入同一值。 |
| 网站返回 502 | 查看 PM2 日志，检查本地服务响应及代理端口。 |
| 页面无样式或图片 404 | 构建后执行 `deploy:prepare`，检查 `public` 链接与 Nginx 冲突规则。 |
| 后台提示仅允许本站提交 | 检查 `TRUST_PROXY`、代理 `Host` 与 `X-Forwarded-Proto`，重启服务。 |
| 登录后仍返回登录页 | 使用正式 HTTPS 地址，检查域名与代理配置。 |
| 保存或上传失败 | 检查运行用户及数据库、上传和图片缓存目录写权限。 |
| 追番未按时同步 | 确认 PM2 持续运行，查看“我的追番”的下次同步时间与错误提示，检查 Token 是否过期及服务器能否访问 Bangumi。 |
| 端口占用 | 停止重复进程；调整 `PORT` 时同步修改 Nginx 代理地址。 |
