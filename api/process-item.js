const response = require('../utils/response')
const Imap = require('node-imap');

module.exports = async (ctx, next) => {

    const { password } = ctx.method === 'GET' ? ctx.query : ctx.request.body;

    const expectedPassword = process.env.PASSWORD;

    if (password !== expectedPassword && expectedPassword) {
        return response.error(ctx, { error: 'Authentication failed. Please provide valid credentials or contact administrator for access. Refer to API documentation for deployment details.' }, 401)
    }

    // 根据请求方法从 query 或 body 中获取参数
    const params = ctx.method === 'GET' ? ctx.query : ctx.request.body;
    const { refresh_token, client_id, email } = params;

    // 检查是否缺少必要的参数
    if (!refresh_token || !client_id || !email) {
        return response.error(ctx, { error: 'Missing required parameters: refresh_token, client_id, or email' }, 400);
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
                'refresh_token': refresh_token,
                'resource': 'https://outlook.office365.com/EWS.AccessAsUser.All'
            }).toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const responseText = await response.text();

        try {
            const data = JSON.parse(responseText);
            console.log(data);

            return await cleanupRecoverableItemsWithEWS(data.accessToken)

            return data.access_token;
        } catch (parseError) {
            throw new Error(`Failed to parse JSON: ${parseError.message}, response: ${responseText}`);
        }
    }

    const generateAuthString = (user, accessToken) => {
        const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
        return Buffer.from(authString).toString('base64');
    }

    async function cleanupRecoverableItemsWithEWS(accessToken, email) {

        const soapRequest = `
    <?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
        <soap:Header>
            <t:RequestServerVersion Version="Exchange2016"/>
        </soap:Header>
        <soap:Body>
            <EmptyFolder xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
                <FolderIds>
                    <t:DistinguishedFolderId Id="recoverableitemsroot"/>
                </FolderIds>
                <DeleteType>HardDelete</DeleteType>
            </EmptyFolder>
        </soap:Body>
    </soap:Envelope>
`;
        const response = await fetch('https://outlook.office365.com/EWS/Exchange.asmx', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml',
                'Authorization': `Bearer ${access_token}`
            },
            body: soapRequest
        });

        if (!response.ok) {
            throw new Error(`EWS Error: ${response.statusText}`);
        }

        return await response.text();
    }

    await get_access_token();

    response.success(ctx, { message: '邮件正在清空中... 请稍后查看邮件' });


};