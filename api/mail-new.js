const Imap = require('node-imap');
const simpleParser = require("mailparser").simpleParser;

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

const generateAuthString = (user, accessToken) => {
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
}

module.exports = async (req, res) => {
    const { refresh_token, client_id, email, mailbox, response_type = 'json' } = req.query; // 从查询参数中获取

    // 检查是否缺少必要的参数
    if (!refresh_token || !client_id || !email || !mailbox) {
        return res.status(400).json({ error: 'Missing required parameters: refresh_token, client_id, email, or mailbox' });
    }

    try {
        const access_token = await get_access_token(refresh_token, client_id);
        const authString = generateAuthString(email, access_token);

        const imap = new Imap({
            user: email,
            xoauth2: authString,
            host: 'outlook.office365.com',
            port: 993,
            tls: true,
            tlsOptions: {
                rejectUnauthorized: false
            }
        });

        imap.once("ready", async () => {
            try {
                // 动态打开指定的邮箱（如 INBOX 或 Junk）
                await new Promise((resolve, reject) => {
                    imap.openBox(mailbox, true, (err, box) => {
                        if (err) return reject(err);
                        resolve(box);
                    });
                });

                const results = await new Promise((resolve, reject) => {
                    imap.search(["ALL"], (err, results) => {
                        if (err) return reject(err);
                        const latestMail = results.slice(-1);
                        resolve(latestMail);
                    });
                });

                const f = imap.fetch(results, { bodies: "" });

                f.on("message", (msg, seqno) => {
                    msg.on("body", (stream, info) => {
                        simpleParser(stream, (err, mail) => {
                            if (err) throw err;
                            function extractVerificationCode(text) {
                                const regex = /\b\d{6}\b/;
                                const match = text.match(regex);
                                return match ? match[0] : "验证码未找到";
                            }

                            const responseData = {
                                send: mail.from.text,
                                subject: mail.subject,
                                text: mail.text,
                                code: extractVerificationCode(mail.text)
                            };

                            if (response_type === 'json') {
                                res.status(200).json(responseData);
                            } else if (response_type === 'html') {
                                // 格式化 HTML 响应
                                const htmlResponse = `
                                    <html>
                                        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f9f9f9;">
                                            <div style="margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                                <h1 style="color: #333;">邮件信息</h1>
                                                <p><strong>发件人:</strong> ${responseData.send}</p>
                                                <p><strong>主题:</strong> ${responseData.subject}</p>
                                                <div style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd;">
                                                    <p><strong>内容:</strong></p>
                                                    <p>${responseData.text.replace(/\n/g, '<br>')}</p>
                                                </div>
                                                <p><strong>验证码:</strong> <span style="font-size: 24px; color: #007BFF;">${responseData.code}</span></p>
                                            </div>
                                        </body>
                                    </html>
                                `;
                                res.status(200).send(htmlResponse);
                            } else {
                                res.status(400).json({ error: 'Invalid response_type. Use "json" or "html".' });
                            }
                        });
                    });
                });

                f.once("end", () => {
                    imap.end();
                });
            } catch (err) {
                imap.end();
                res.status(500).json({ error: err.message });
            }
        });

        imap.once('error', (err) => {
            console.error('IMAP error:', err);
            res.status(500).json({ error: err.message });
        });

        imap.connect();

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
};
