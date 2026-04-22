const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const importAccountsModule = require('../api/accounts/import');
const listAccountsModule = require('../api/accounts/list');
const shareMailListModule = require('../api/share-mail-list');

function createTempFilePath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-share-public-'));
  return path.join(tempDir, 'accounts.json');
}

function createEnv() {
  return {
    PASSWORD: 'admin-secret',
    SHARE_TOKEN_SECRET: 'share-secret',
    ACCOUNT_STORE_FILE: createTempFilePath(),
  };
}

async function invokeHandler(handler, req) {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
    send(body) {
      this.payload = body;
      return this;
    },
  };

  await handler(req, response);
  return response;
}

async function seedSharedAccount(env) {
  const importHandler = importAccountsModule.createHandler({ env });
  const listHandler = listAccountsModule.createHandler({ env });

  await invokeHandler(importHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      rows: [
        {
          email: 'shared@example.com',
          password: 'shared-password',
          clientId: 'shared-client',
          refreshToken: 'shared-refresh',
        },
      ],
    },
  });

  const listResponse = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  return listResponse.payload.accounts[0];
}

test('share-mail-list returns mail for a valid share token', async () => {
  const env = createEnv();
  const account = await seedSharedAccount(env);
  let capturedParams = null;
  const handler = shareMailListModule.createHandler({
    env,
    fetchMailListImpl: async (params) => {
      capturedParams = params;
      return [
        {
          send: 'sender@example.com',
          subject: 'Subject',
          text: 'Body',
          html: '<p>Body</p>',
          date: '2026-04-22T00:00:00.000Z',
        },
      ];
    },
  });

  const response = await invokeHandler(handler, {
    method: 'GET',
    query: {
      share: account.shareToken,
      mailbox: 'Junk',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.email, 'shared@example.com');
  assert.equal(response.payload.messages.length, 1);
  assert.deepEqual(capturedParams, {
    refreshToken: 'shared-refresh',
    clientId: 'shared-client',
    email: 'shared@example.com',
    mailbox: 'Junk',
  });
});

test('share-mail-list rejects missing share token', async () => {
  const env = createEnv();
  const handler = shareMailListModule.createHandler({ env });

  const response = await invokeHandler(handler, {
    method: 'GET',
    query: {},
  });

  assert.equal(response.statusCode, 400);
});

test('share-mail-list rejects an invalid share token', async () => {
  const env = createEnv();
  await seedSharedAccount(env);
  const handler = shareMailListModule.createHandler({ env });

  const response = await invokeHandler(handler, {
    method: 'GET',
    query: {
      share: 'acct_invalid.badtoken',
    },
  });

  assert.equal(response.statusCode, 401);
});
