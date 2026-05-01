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

    const { store, shareTokens } = createAccountRuntime(env);
    const accounts = await store.listAccounts();

    return res.status(200).json({
      accounts: accounts.map((account) => serializeAccount(account, shareTokens)),
    });
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
