const Imap = require('node-imap');

module.exports = async (req, res) => {

    const { password } = req.method === 'GET' ? req.query : req.body;

    const expectedPassword = process.env.PASSWORD;

    if (password !== expectedPassword) {
        return res.status(401).json({
            error: 'Authentication failed. Please provide valid credentials or contact administrator for access. Refer to API documentation for deployment details.'
        });
    }

    // 根据请求方法从 query 或 body 中获取参数
    const params = req.method === 'GET' ? req.query : req.body;
    const { refresh_token, client_id, email } = params;

    // 检查是否缺少必要的参数
    if (!refresh_token || !client_id || !email) {
        return res.status(400).json({ error: 'Missing required parameters: refresh_token, client_id, or email' });
    }

    async function get_access_token() {
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

    try {
        const access_token = await get_access_token();
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

        async function openInbox() {
            return new Promise((resolve, reject) => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) return reject(err);
                    resolve(box);
                });
            });
        }

        async function openJunkFolder() {
            return new Promise((resolve, reject) => {
                imap.openBox('Junk', false, (err, box) => {
                    if (err) return reject(err);
                    resolve(box);
                });
            });
        }

        async function searchEmails() {
            return new Promise((resolve, reject) => {
                imap.search(['ALL'], (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                });
            });
        }

        async function markAsDeleted(uids) {
            return new Promise((resolve, reject) => {
                imap.addFlags(uids, ['\\Deleted'], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        }

        async function expungeDeleted() {
            return new Promise((resolve, reject) => {
                imap.expunge((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        }

        imap.once('ready', async () => {
            try {
                await openInbox();
                await openJunkFolder();

                const results = await searchEmails();
                if (results.length === 0) {
                    console.log('No junk emails found.');
                    imap.end();
                    return res.json({ message: 'No junk emails found.' });
                }

                const f = imap.fetch(results, { bodies: '' });

                f.on('message', (msg, seqno) => {
                    console.log('Message #%d', seqno);
                    msg.on('attributes', async (attrs) => {
                        await markAsDeleted([attrs.uid]);
                        console.log('Marked as deleted:', seqno);
                    });
                });

                f.once('error', (err) => {
                    console.log('Fetch error: ' + err);
                    imap.end();
                    return res.status(500).json({ error: 'Fetch error', details: err.message });
                });

                f.once('end', async () => {
                    console.log('Done fetching all messages!');
                    await expungeDeleted();
                    console.log('Expunged deleted messages.');
                    imap.end();
                    return res.json({ message: 'Emails processed successfully.' });
                });
            } catch (err) {
                console.error('Error:', err);
                imap.end();
                return res.status(500).json({ error: 'Error processing emails', details: err.message });
            }
        });

        imap.once('error', (err) => {
            console.log(err);
            imap.end();
            return res.status(500).json({ error: 'IMAP connection error', details: err.message });
        });

        imap.once('end', () => {
            console.log('Connection ended');
        });

        imap.connect();

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Error', details: error.message });
    }
};