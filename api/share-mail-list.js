const { getRequestParams } = require('./_lib/admin-auth');
const { createAccountRuntime } = require('./_lib/account-api');
const { fetchMailList } = require('./_lib/mail-service');

function createHandler({ env = process.env, fetchMailListImpl = fetchMailList } = {}) {
  return async (req, res) => {
    const params = getRequestParams(req);

    if (!params.share) {
      return res.status(400).json({
        error: 'share is required',
      });
    }

    const { store, shareTokens } = createAccountRuntime(env);
    const parsedShare = shareTokens.parseToken(params.share);

    if (!parsedShare) {
      return res.status(401).json({
        error: 'Invalid share token',
      });
    }

    const account = await store.getAccountById(parsedShare.accountId);

    if (!account || !shareTokens.isValid(account, params.share)) {
      return res.status(401).json({
        error: 'Invalid share token',
      });
    }

    const mailbox = params.mailbox || 'INBOX';
    const messages = await fetchMailListImpl({
      refreshToken: account.refreshToken,
      clientId: account.clientId,
      email: account.email,
      mailbox,
    });

    return res.status(200).json({
      email: account.email,
      mailbox,
      messages,
    });
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
