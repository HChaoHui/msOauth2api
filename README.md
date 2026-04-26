# 微软 OAuth2 API 无服务器版本

> **服务器版本看另一个仓库 https://github.com/HChaoHui/MS_OAuth2API_Next**

🌟 **简化微软 OAuth2 认证流程，轻松集成到你的应用中！** 🌟

本项目将微软的 OAuth2 认证取件流程封装成一个简单的 API，并部署在 Vercel 的无服务器平台上。通过这个 API，你可以轻松地在你的应用中进行 OAuth2 取件功能。   
目前已支持 **Graph API** 取件 会自动判断是否是Graph API   
推荐使用Graph API取件 比IMAP取件速度更快 更稳定

## 🚀 快速开始

1. **Star 本项目**：首先，点击右上角的 `Star` 按钮，给这个项目点个赞吧！

2. **Fork 本项目**：点击右上角的 `Fork` 按钮，将项目复制到你的 GitHub 账户下。

3. **部署到 Vercel**：
   - 点击下面的按钮，一键部署到 Vercel。

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/HChaoHui/msOauth2api)

   - 在 Vercel 部署页面，填写你的项目名称，然后点击 `Deploy` 按钮。

4. **开始使用**：
   - 部署完成后，你可以通过访问 `https://your-vercel-app.vercel.app` 查看接口文档来进行使用。
   - **注意**：Vercel 的链接在国内可能无法访问，请使用自己的域名进行 CNAME 解析或使用 Cloudflare 进行代理。

## Docker / 宝塔部署

这个仓库现在也可以作为常驻 Node 服务运行，并通过 Docker 部署到宝塔面板。

### 数据存储

- 优先支持 **标准 Redis**，适合直接连接宝塔面板里的 Redis 服务。
- 如果配置了 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`，会改用 Upstash Redis REST。
- 如果 Redis 配置都不存在，才会回退到本地 `data/accounts.json` 文件存储。

标准 Redis 支持以下环境变量：

- `REDIS_HOST`：Redis 主机地址
- `REDIS_PORT`：Redis 端口，默认 `6379`
- `REDIS_PASSWORD`：Redis 密码，没有可以留空
- `REDIS_DB`：Redis 数据库编号，默认 `0`
- `REDIS_USERNAME`：可选，Redis 用户名
- `REDIS_URL`：可选，使用单个连接串代替上面的分项配置
- `PASSWORD`：后台管理密码
- `SHARE_TOKEN_SECRET`：分享链接签名密钥

### 本地 Docker 运行

```bash
docker compose up -d --build
```

默认服务端口为 `3000`，容器启动命令会运行：

```bash
node scripts/local-dev-server.js
```

### 宝塔部署步骤

1. 在宝塔服务器上安装 Docker 和 Docker Compose 插件。
2. 在宝塔中准备好可访问的 Redis 实例，记下主机、端口、密码和数据库编号。
3. 拉取本仓库代码后，修改 `docker-compose.yml` 里的 `PASSWORD`、`SHARE_TOKEN_SECRET`、`REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`、`REDIS_DB`。
4. 在项目目录执行 `docker compose up -d --build` 启动容器。
5. 在宝塔网站里为 `mail.manyaccs.com` 创建站点或反向代理，把请求转发到宿主机 `127.0.0.1:3000`。
6. 域名在 Cloudflare 开启代理时，HTTPS 由 Cloudflare 负责，容器内部只需要提供 HTTP 服务。

### 适合 `mail.manyaccs.com` 的建议

- Cloudflare 负责外网 HTTPS
- 宝塔负责域名绑定和反向代理
- 应用容器只负责监听 `3000`
- `docker-compose.yml` 默认只把端口绑定到宿主机 `127.0.0.1`，更适合交给宝塔反向代理
- Redis 负责账号数据持久化

## 📚 API 文档

### 📧 获取最新的一封邮件

- **方法**: `GET`
- **URL**: `/api/mail-new`
- **描述**: 获取最新的一封邮件。如果邮件中含有6位数字验证码，会自动提取。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。
  - `mailbox` (必填): 邮箱文件夹，支持的值为 `INBOX` 或 `Junk`。
  - `response_type` (可选): 返回格式，支持的值为 `json` 或 `html`，默认为 `json`。

### 📨 获取全部邮件

- **方法**: `GET`
- **URL**: `/api/mail-all`
- **描述**: 获取全部邮件。如果邮件中含有6位数字验证码，会自动提取。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。
  - `mailbox` (必填): 邮箱文件夹，支持的值为 `INBOX` 或 `Junk`。

### 🗑️ 清空收件箱

- **方法**: `GET`
- **URL**: `/api/process-inbox`
- **描述**: 清空收件箱。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。

### 🗑️ 清空垃圾箱

- **方法**: `GET`
- **URL**: `/api/process-junk`
- **描述**: 清空垃圾箱。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。

## 🖼️ 效果图

![Demo](https://raw.githubusercontent.com/HChaoHui/msOauth2api/refs/heads/main/img/demo.png)

## 🤝 贡献

欢迎大家贡献代码！如果你有任何问题或建议，请提交 [Issue](https://github.com/HChaoHui/msOauth2api/issues) 或联系作者邮箱：**[z@unix.xin]**。

## 📜 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 💖 支持

如果你喜欢这个项目，欢迎给它一个 Star ⭐️ 或者进行赞助：

![Buy](https://github.com/HChaoHui/msOauth2api/blob/main/img/Buy.JPG?raw=true)

---

**Happy Coding!** 🎉
