const { getRequestParams, isAdminAuthorized } = require('../_lib/admin-auth');
const { createAccountRuntime } = require('../_lib/account-api');
const { fetchMailList } = require('../_lib/mail-service');

function createHandler({ env = process.env, fetchMailListImpl = fetchMailList } = {}) {
  return async (req, res) => {
    const params = getRequestParams(req);

    if (!isAdminAuthorized(params, env)) {
      return res.status(401).json({
        error: 'Authentication failed. Please provide valid credentials or contact administrator for access. Refer to API documentation for deployment details.',
      });
    }

    if (!params.accountId) {
      return res.status(400).json({
        error: 'accountId is required',
      });
    }

    const { store } = createAccountRuntime(env);
    const account = await store.getAccountById(params.accountId);

    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
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
