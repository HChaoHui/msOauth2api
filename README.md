# 微软 OAuth2 API 无服务器版本

🌟 **简化微软 OAuth2 认证流程，轻松集成到你的应用中！** 🌟

本项目将微软的 OAuth2 认证取件流程封装成一个简单的 API，并部署在 Vercel 的无服务器平台上。通过这个 API，你可以轻松地在你的应用中进行 OAuth2 取件功能。

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