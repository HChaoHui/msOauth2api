# 微软 OAuth2 API 无服务器版本

> **服务器版本看另一个仓库 https://github.com/HChaoHui/MS_OAuth2API_Next**

🌟 **简化微软 OAuth2 认证流程，轻松集成到你的应用中！** 🌟

本项目将微软的 OAuth2 认证取件流程封装成一个简单的 API，并部署在 Vercel 的无服务器平台上。通过这个 API，你可以轻松地在你的应用中进行 OAuth2 取件功能。   
目前已支持 **Graph API** 取件 会自动判断是否是Graph API   
推荐使用Graph API取件 比IMAP取件速度更快 更稳定

同时提供 `mail.html` 在线邮箱管理页面，支持账号导入、收件箱/垃圾箱查看、Refresh Token 批量刷新、AI 邮件解读等功能。

## 🚀 快速开始

1. **Star 本项目**：首先，点击右上角的 `Star` 按钮，给这个项目点个赞吧！

2. **Fork 本项目**：点击右上角的 `Fork` 按钮，将项目复制到你的 GitHub 账户下。

3. **部署到 Vercel**：
   - 点击下面的按钮，一键部署到 Vercel。

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/HChaoHui/msOauth2api)

   - 在 Vercel 部署页面，填写你的项目名称，然后点击 `Deploy` 按钮。

4. **开始使用**：
   - 部署完成后，你可以通过访问 `https://your-vercel-app.vercel.app` 查看接口文档来进行使用。
   - 在线邮箱管理页面地址：`https://your-vercel-app.vercel.app/mail.html`。
   - **注意**：Vercel 的链接在国内可能无法访问，请使用自己的域名进行 CNAME 解析或使用 Cloudflare 进行代理。

## ⚙️ 环境变量

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `PASSWORD` | 否 | 接口访问密码，用于保护取件、清空邮箱、刷新 Token 和 AI 解读接口。配置后请求必须传入正确密码。 |
| `SEND_PASSWORD` | 否 | 发信接口访问密码，用于保护 `/api/send-mail`。 |
| `AI_API_KEY` | 否 | AI 解读接口使用的 API Key。 |
| `AI_API_URL` | 否 | OpenAI 兼容接口地址，例如 `https://api.example.com`。 |
| `AI_MODEL` | 否 | AI 解读使用的模型名称。 |

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
  - `password` (可选): 配置 `PASSWORD` 后必填。

### 📨 获取全部邮件

- **方法**: `GET`
- **URL**: `/api/mail-all`
- **描述**: 获取全部邮件。如果邮件中含有6位数字验证码，会自动提取。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。
  - `mailbox` (必填): 邮箱文件夹，支持的值为 `INBOX` 或 `Junk`。
  - `password` (可选): 配置 `PASSWORD` 后必填。

### 🔄 刷新 Refresh Token

- **方法**: `GET` 或 `POST`
- **URL**: `/api/refresh-token`
- **描述**: 使用当前 refresh_token 向微软 OAuth2 接口换取新的 refresh_token，适合在 `mail.html` 中批量刷新账号 Token。
- **参数说明**:
  - `refresh_token` (必填): 当前 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `password` (可选): 配置 `PASSWORD` 后必填。
- **返回示例**:

```json
{
  "refresh_token": "new_refresh_token"
}
```

### 🗑️ 清空收件箱

- **方法**: `GET`
- **URL**: `/api/process-inbox`
- **描述**: 清空收件箱。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。
  - `password` (可选): 配置 `PASSWORD` 后必填。

### 🗑️ 清空垃圾箱

- **方法**: `GET`
- **URL**: `/api/process-junk`
- **描述**: 清空垃圾箱。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 邮箱地址。
  - `password` (可选): 配置 `PASSWORD` 后必填。

### 📤 发送邮件

- **方法**: `GET` 或 `POST`
- **URL**: `/api/send-mail`
- **描述**: 使用微软 OAuth2 SMTP 发送邮件。
- **参数说明**:
  - `refresh_token` (必填): 用于身份验证的 refresh_token。
  - `client_id` (必填): 客户端 ID。
  - `email` (必填): 发件人邮箱地址。
  - `to` (必填): 收件人邮箱地址。
  - `subject` (必填): 邮件主题。
  - `text` (可选): 纯文本正文，与 `html` 二选一。
  - `html` (可选): HTML 正文，与 `text` 二选一。
  - `send_password` (可选): 配置 `SEND_PASSWORD` 后必填。

### 🤖 AI 邮件解读

- **方法**: `POST`
- **URL**: `/api/ai`
- **描述**: OpenAI 兼容格式代理接口，支持 SSE 流式输出，用于 `mail.html` 邮件摘要解读。
- **参数说明**:
  - `messages` (必填): OpenAI Chat Completions 格式消息数组。
  - `password` (可选): 配置 `PASSWORD` 后必填。

## 🖼️ 效果图

![Demo](https://raw.githubusercontent.com/HChaoHui/msOauth2api/refs/heads/main/img/demoV2.png)

## 📝 更新日志

### v2.1.0 (2026-05-29)

**Refresh Token 管理**
- 新增 `/api/refresh-token` 后端封装接口，用于 `mail.html` 批量刷新 Refresh Token。
- `mail.html` 支持勾选账号后批量刷新 Refresh Token。
- Refresh Token 列显示优化为前 6 位 + 后 10 位，中间使用 `...` 省略，悬停仍可查看完整内容。

**邮箱管理页优化**
- 工具栏增加清晰标签，降低新用户理解成本。
- 页面改为一屏布局，中间表格区域固定高度并支持内部滚动。
- 表格复选框列对齐优化，表头滚动时保持固定。
- 底部新增 `Powered by MS OAuth2API` GitHub 链接。

**交互与安全提示**
- 刷新 Token 和批量删除均改为页面内确认弹窗，不再使用浏览器原生弹窗。
- 全站统一 401 密码错误提示。
- 修复搜索过滤后行内操作可能定位到错误账号的问题。

### v2.0.0 (2026-05-24)

**全新 UI 重构**
- 采用极简主义设计风格，黑白灰配色
- 移除侧边栏和仪表盘，简化页面结构
- 响应式布局，支持移动端

**功能优化**
- 工具栏整合：搜索账号、验证密码、导入账号、批量删除
- 密码独立设置，不再放在导入弹窗中
- Refresh Token 列自动省略，悬停显示完整内容
- 搜索功能简化，仅支持按账号搜索
- 分隔符默认值设为 `----`

**AI 解读功能**
- 新增 `/api/ai` 代理接口，保护 API Key 安全
- 支持 OpenAI 兼容格式 SSE 流式输出
- 实时显示 AI 思考过程（reasoning）
- Markdown 格式摘要渲染
- 密码验证保护，防止滥用

**技术改进**
- CSS/JS 文件分离，便于维护
- IIFE 模块化 JavaScript
- 事件委托优化交互绑定

## 🤝 贡献

欢迎大家贡献代码！如果你有任何问题或建议，请提交 [Issue](https://github.com/HChaoHui/msOauth2api/issues) 或联系作者邮箱：**[z@unix.xin]**。

## 📜 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 💖 支持

如果你喜欢这个项目，欢迎给它一个 Star ⭐️ 或者进行赞助：

![Buy](https://github.com/HChaoHui/msOauth2api/blob/main/img/Buy.JPG?raw=true)

---

**Happy Coding!** 🎉
