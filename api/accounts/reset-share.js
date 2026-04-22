const { getRequestParams, isAdminAuthorized } = require('../_lib/admin-auth');
const { createAccountRuntime, serializeAccount } = require('../_lib/account-api');

function createHandler({ env = process.env } = {}) {
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

    const { store, shareTokens } = createAccountRuntime(env);
    const account = await store.rotateShareNonce(params.accountId);

    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
      });
    }

    return res.status(200).json({
      account: serializeAccount(account, shareTokens),
    });
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
