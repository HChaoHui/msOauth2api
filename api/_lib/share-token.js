const crypto = require('node:crypto');

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createSignature(secret, accountId, shareNonce) {
  return toBase64Url(
    crypto
      .createHmac('sha256', secret)
      .update(`${accountId}:${shareNonce}`)
      .digest()
  );
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createShareTokenService({ secret }) {
  if (!secret) {
    throw new Error('Missing share token secret');
  }

  return {
    createToken(account) {
      if (!account?.id || !account?.shareNonce) {
        throw new Error('Account id and shareNonce are required');
      }

      const signature = createSignature(secret, account.id, account.shareNonce);
      return `${account.id}.${signature}`;
    },

    parseToken(token) {
      if (!token || typeof token !== 'string') {
        return null;
      }

      const [accountId, signature, ...rest] = token.split('.');

      if (!accountId || !signature || rest.length > 0) {
        return null;
      }

      return {
        accountId,
        signature,
      };
    },

    isValid(account, token) {
      const parsed = this.parseToken(token);

      if (!parsed || !account?.id || !account?.shareNonce) {
        return false;
      }

      if (parsed.accountId !== account.id) {
        return false;
      }

      const expectedSignature = createSignature(secret, account.id, account.shareNonce);
      return safeEquals(parsed.signature, expectedSignature);
    },
  };
}

module.exports = {
  createShareTokenService,
};
