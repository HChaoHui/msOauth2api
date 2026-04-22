const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createAccountStoreFromEnv,
  createFileAccountStore,
} = require('../api/_lib/account-store');
const { createShareTokenService } = require('../api/_lib/share-token');

function createTempFilePath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-share-store-'));
  return path.join(tempDir, 'accounts.json');
}

function createAccount(email, suffix = email) {
  return {
    email,
    password: `password-${suffix}`,
    clientId: `client-${suffix}`,
    refreshToken: `refresh-${suffix}`,
  };
}

test('file account store imports and lists accounts', async () => {
  const store = createFileAccountStore({
    filePath: createTempFilePath(),
  });

  const result = await store.importAccounts([
    createAccount('alpha@example.com', 'alpha'),
    createAccount('beta@example.com', 'beta'),
  ]);

  assert.equal(result.importedCount, 2);

  const accounts = await store.listAccounts();

  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].email, 'beta@example.com');
  assert.equal(accounts[1].email, 'alpha@example.com');
  assert.ok(accounts[0].id);
  assert.ok(accounts[0].shareNonce);
});

test('file account store updates existing email without changing share identity', async () => {
  const store = createFileAccountStore({
    filePath: createTempFilePath(),
  });

  await store.importAccounts([createAccount('alpha@example.com', 'first')]);
  const first = (await store.listAccounts())[0];

  await store.importAccounts([createAccount('alpha@example.com', 'second')]);
  const second = (await store.listAccounts())[0];

  assert.equal(second.email, 'alpha@example.com');
  assert.equal(second.id, first.id);
  assert.equal(second.shareNonce, first.shareNonce);
  assert.equal(second.password, 'password-second');
  assert.equal(second.clientId, 'client-second');
  assert.equal(second.refreshToken, 'refresh-second');
});

test('file account store deletes one or many accounts', async () => {
  const store = createFileAccountStore({
    filePath: createTempFilePath(),
  });

  await store.importAccounts([
    createAccount('alpha@example.com', 'alpha'),
    createAccount('beta@example.com', 'beta'),
    createAccount('gamma@example.com', 'gamma'),
  ]);

  const accounts = await store.listAccounts();
  await store.deleteAccount(accounts[1].id);
  await store.deleteAccounts([accounts[0].id, accounts[2].id]);

  assert.deepEqual(await store.listAccounts(), []);
});

test('file account store rotates share nonce for one account', async () => {
  const store = createFileAccountStore({
    filePath: createTempFilePath(),
  });

  await store.importAccounts([createAccount('alpha@example.com', 'alpha')]);
  const before = (await store.listAccounts())[0];

  const updated = await store.rotateShareNonce(before.id);

  assert.notEqual(updated.shareNonce, before.shareNonce);
  assert.equal(updated.id, before.id);
});

test('share token service creates deterministic tokens and validates them', () => {
  const shareTokens = createShareTokenService({
    secret: 'test-secret',
  });

  const account = {
    id: 'acct_123',
    shareNonce: 'nonce_123',
  };

  const token = shareTokens.createToken(account);

  assert.match(token, /^acct_123\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(shareTokens.parseToken(token), {
    accountId: 'acct_123',
    signature: token.split('.')[1],
  });
  assert.equal(shareTokens.isValid(account, token), true);
  assert.equal(shareTokens.isValid(account, 'acct_123.invalid'), false);
  assert.equal(shareTokens.isValid({ ...account, shareNonce: 'other' }, token), false);
});

test('rotating the share nonce changes the derived token', async () => {
  const store = createFileAccountStore({
    filePath: createTempFilePath(),
  });
  const shareTokens = createShareTokenService({
    secret: 'test-secret',
  });

  await store.importAccounts([createAccount('alpha@example.com', 'alpha')]);

  const before = (await store.listAccounts())[0];
  const beforeToken = shareTokens.createToken(before);
  const after = await store.rotateShareNonce(before.id);
  const afterToken = shareTokens.createToken(after);

  assert.notEqual(afterToken, beforeToken);
  assert.equal(shareTokens.isValid(after, afterToken), true);
  assert.equal(shareTokens.isValid(after, beforeToken), false);
});

test('account store factory uses Upstash REST storage when Redis env vars exist', async () => {
  const remoteState = {
    snapshot: null,
  };
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/get/mail_share_accounts_v1')) {
      return {
        ok: true,
        json: async () => ({
          result: remoteState.snapshot,
        }),
      };
    }

    if (url.endsWith('/set/mail_share_accounts_v1')) {
      remoteState.snapshot = options.body;
      return {
        ok: true,
        json: async () => ({
          result: 'OK',
        }),
      };
    }

    throw new Error(`Unexpected Upstash URL: ${url}`);
  };

  const store = createAccountStoreFromEnv({
    env: {
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    },
    fetchImpl,
  });

  await store.importAccounts([createAccount('remote@example.com', 'remote')]);

  const accounts = await store.listAccounts();

  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].email, 'remote@example.com');
  assert.match(remoteState.snapshot, /remote@example\.com/);
});
