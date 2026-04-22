const { createAccountStoreFromEnv } = require('./account-store');
const { createShareTokenService } = require('./share-token');

function createAccountRuntime(env = process.env) {
  return {
    store: createAccountStoreFromEnv({ env }),
    shareTokens: createShareTokenService({
      secret: env.SHARE_TOKEN_SECRET,
    }),
  };
}

function serializeAccount(account, shareTokens) {
  const { shareNonce, ...safeAccount } = account;

  return {
    ...safeAccount,
    shareToken: shareTokens.createToken(account),
  };
}

module.exports = {
  createAccountRuntime,
  serializeAccount,
};
