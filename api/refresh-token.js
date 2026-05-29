module.exports = async (req, res) => {
    const params = req.method === 'GET' ? req.query : req.body;
    const { refresh_token, client_id, password } = params;
    const expectedPassword = process.env.PASSWORD;

    if (password !== expectedPassword && expectedPassword) {
        return res.status(401).json({ error: '密码验证失败' });
    }

    if (!refresh_token || !client_id) {
        return res.status(400).json({ error: 'Missing required parameters: refresh_token or client_id' });
    }

    try {
        const tokenResponse = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id,
                grant_type: 'refresh_token',
                refresh_token
            }).toString()
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            return res.status(tokenResponse.status).json({
                error: 'Refresh token failed',
                details: errorText
            });
        }

        const data = await tokenResponse.json();

        return res.status(200).json({
            refresh_token: data.refresh_token || refresh_token
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(500).json({ error: 'Refresh token failed', details: error.message });
    }
};
