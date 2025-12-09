const response = require('../utils/response')
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

async function graph_api(refresh_token, client_id) {
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': client_id,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'scope': 'https://graph.microsoft.com/.default'
        }).toString()
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    const responseText = await response.text();

    try {
        const data = JSON.parse(responseText);

        if (data.scope.indexOf('https://graph.microsoft.com/Mail.ReadWrite') != -1) {
            return {
                access_token: data.access_token,
                status: true
            }
        }

        return {
            access_token: data.access_token,
            status: false
        }
    } catch (parseError) {
        throw new Error(`Failed to parse JSON: ${parseError.message}, response: ${responseText}`);
    }
}

const getAllMail = (email, authString, mailbox) => {
    return new Promise((resolve, reject) => {
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
        const emailList = [];

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
                        resolve(results);
                    });
                });

                const f = imap.fetch(results, { bodies: "" });

                f.on("message", (msg, seqno) => {
                    msg.on("body", (stream, info) => {
                        simpleParser(stream, (err, mail) => {
                            if (err) throw err;
                            const data = {
                                send: mail.from.text,
                                subject: mail.subject,
                                text: mail.text,
                                html: mail.html,
                                date: mail.date,
                            };

                            emailList.push(data);
                        });
                    });
                });

                f.once("end", () => {
                    imap.end();
                });
            } catch (err) {
                imap.end();
                reject(err);
            }
        });

        imap.once('error', (err) => {
            console.error('IMAP error:', err);
            reject(err);
        });

        imap.once('end', () => {
            resolve(emailList);
            console.log('IMAP connection ended');
        });

        imap.connect();
    })
}

async function get_emails(access_token, mailbox) {

    if (!access_token) {
        console.log("Failed to obtain access token'");
        return;
    }

    try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${mailbox}/messages?$top=10000`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                "Authorization": `Bearer ${access_token}`
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return
        }

        const responseData = await response.json();

        const emails = responseData.value;

        const response_emails = emails.map(item => {
            return {
                send: item['from']['emailAddress']['address'],
                subject: item['subject'],
                text: item['bodyPreview'],
                html: item['body']['content'],
                date: item['createdDateTime'],
            }
        })

        return response_emails

    } catch (error) {
        console.error('Error fetching emails:', error);
        return;
    }

}

module.exports = async (ctx, next) => {

    const { password } = ctx.method === 'GET' ? ctx.query : ctx.request.body;

    const expectedPassword = process.env.PASSWORD;

    if (password !== expectedPassword && expectedPassword) {
        return response.error(ctx, { error: 'Authentication failed. Please provide valid credentials or contact administrator for access. Refer to API documentation for deployment details.' }, 401);
    }

    // 根据请求方法从 query 或 body 中获取参数
    let { refresh_token, client_id, email, mailbox } = ctx.method === 'GET' ? ctx.query : ctx.request.body;

    // 检查是否缺少必要的参数
    if (!refresh_token || !client_id || !email || !mailbox) {
        return response.error(ctx, { error: 'Missing required parameters: refresh_token, client_id, email, or mailbox' }, 400);
    }

    try {

        console.log("判断是否graph_api");

        const graph_api_result = await graph_api(refresh_token, client_id)

        if (graph_api_result.status) {

            console.log("是graph_api");

            if (mailbox != "INBOX" && mailbox != "Junk") {
                mailbox = "inbox";
            }

            if (mailbox == 'INBOX') {
                mailbox = 'inbox';
            }

            if (mailbox == 'Junk') {
                mailbox = 'junkemail';
            }

            const result = await get_emails(graph_api_result.access_token, mailbox);

            response.success(ctx, result);

            return
        }

        console.log("不是graph_api");

        const access_token = await get_access_token(refresh_token, client_id);
        const authString = generateAuthString(email, access_token);
        const mail_data = await getAllMail(email, authString, mailbox);

        response.success(ctx, mail_data);
    } catch (error) {
        console.error('Error:', error);
        return response.error(ctx, { error: error.message }, 500);
    }
};