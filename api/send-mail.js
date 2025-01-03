const nodemailer = require('nodemailer');

module.exports = async (req, res) => {

    const { send_password } = req.method === 'GET' ? req.query : req.body;

    const expectedPassword = process.env.SEND_PASSWORD;

    if (send_password !== expectedPassword) {
        return res.status(401).json({
            error: 'Authentication failed. Please provide valid credentials or contact administrator for access. Refer to API documentation for deployment details.'
        });
    }

    if (req.method === 'GET' || req.method === 'POST') {
        try {
            // 从查询参数或请求体中获取参数
            const {
                refresh_token,
                client_id,
                email,
                to,
                subject,
                text,
                html
            } = req.method === 'GET' ? req.query : req.body;

            // 检查必传参数
            if (!refresh_token || !client_id || !email || !to || !subject || (!text && !html)) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            // 获取 access_token
            const access_token = await get_access_token(refresh_token, client_id);

            // 创建 Nodemailer 传输器
            const transporter = nodemailer.createTransport({
                host: 'smtp.office365.com', // Outlook SMTP 服务器
                port: 587, // Outlook SMTP 端口
                secure: false, // true for 465, false for other ports
                auth: {
                    type: 'OAuth2',
                    user: email, // 你的邮箱地址
                    clientId: client_id, // 你的客户端 ID
                    accessToken: access_token, // 获取的 access_token
                },
                tls: {
                    ciphers: 'SSLv3'
                }
            });

            // 邮件选项
            const mailOptions = {
                from: email, // 发件人地址
                to: to, // 收件人地址
                subject: subject, // 邮件主题
                text: text, // 纯文本正文
                html: html // HTML 正文
            };

            // 发送邮件
            const info = await transporter.sendMail(mailOptions);
            res.status(200).json({ message: 'Email sent successfully', messageId: info.messageId });
        } catch (error) {
            console.error('Error sending email:', error);
            res.status(500).json({ error: 'Failed to send email', details: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};

async function get_access_token(refresh_token, client_id) {
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': client_id,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }).toString()
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    const responseText = await response.text();

    try {
        const data = JSON.parse(responseText);
        return data.access_token;
    } catch (parseError) {
        throw new Error(`Failed to parse JSON: ${parseError.message}, response: ${responseText}`);
    }
}