const { getRequestParams, isAdminAuthorized } = require('../_lib/admin-auth');
const { createAccountRuntime } = require('../_lib/account-api');

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

    const { store } = createAccountRuntime(env);
    await store.deleteAccount(params.accountId);

    return res.status(200).json({
      deleted: true,
    });
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
