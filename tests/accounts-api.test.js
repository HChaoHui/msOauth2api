const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const importAccountsModule = require('../api/accounts/import');
const listAccountsModule = require('../api/accounts/list');
const deleteAccountModule = require('../api/accounts/delete');
const batchDeleteAccountsModule = require('../api/accounts/batch-delete');
const resetShareModule = require('../api/accounts/reset-share');
const accountMailListModule = require('../api/accounts/mail-list');

function createTempFilePath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-share-api-'));
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

function createRows() {
  return [
    {
      email: 'alpha@example.com',
      password: 'alpha-password',
      clientId: 'alpha-client',
      refreshToken: 'alpha-refresh',
    },
    {
      email: 'beta@example.com',
      password: 'beta-password',
      clientId: 'beta-client',
      refreshToken: 'beta-refresh',
    },
  ];
}

test('account import stores rows and list exposes share tokens', async () => {
  const env = createEnv();
  const importHandler = importAccountsModule.createHandler({ env });
  const listHandler = listAccountsModule.createHandler({ env });

  const importResponse = await invokeHandler(importHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      rows: createRows(),
    },
  });

  assert.equal(importResponse.statusCode, 200);
  assert.equal(importResponse.payload.importedCount, 2);

  const listResponse = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.payload.accounts.length, 2);
  assert.match(listResponse.payload.accounts[0].shareToken, /^acct_[^.]+\.[A-Za-z0-9_-]+$/);
  assert.equal('shareNonce' in listResponse.payload.accounts[0], false);
});

test('reset-share rotates the share token for one account', async () => {
  const env = createEnv();
  const importHandler = importAccountsModule.createHandler({ env });
  const listHandler = listAccountsModule.createHandler({ env });
  const resetHandler = resetShareModule.createHandler({ env });

  await invokeHandler(importHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      rows: [createRows()[0]],
    },
  });

  const beforeList = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  const beforeAccount = beforeList.payload.accounts[0];

  const resetResponse = await invokeHandler(resetHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      accountId: beforeAccount.id,
    },
  });

  assert.equal(resetResponse.statusCode, 200);
  assert.notEqual(resetResponse.payload.account.shareToken, beforeAccount.shareToken);
});

test('delete and batch-delete remove imported accounts', async () => {
  const env = createEnv();
  const importHandler = importAccountsModule.createHandler({ env });
  const listHandler = listAccountsModule.createHandler({ env });
  const deleteHandler = deleteAccountModule.createHandler({ env });
  const batchDeleteHandler = batchDeleteAccountsModule.createHandler({ env });

  await invokeHandler(importHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      rows: [
        ...createRows(),
        {
          email: 'gamma@example.com',
          password: 'gamma-password',
          clientId: 'gamma-client',
          refreshToken: 'gamma-refresh',
        },
      ],
    },
  });

  const beforeList = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  await invokeHandler(deleteHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      accountId: beforeList.payload.accounts[0].id,
    },
  });

  const afterSingleDelete = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  assert.equal(afterSingleDelete.payload.accounts.length, 2);

  await invokeHandler(batchDeleteHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      accountIds: afterSingleDelete.payload.accounts.map((account) => account.id),
    },
  });

  const afterBatchDelete = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  assert.deepEqual(afterBatchDelete.payload.accounts, []);
});

test('mail-list API loads mail by account id instead of raw tokens', async () => {
  const env = createEnv();
  const importHandler = importAccountsModule.createHandler({ env });
  const listHandler = listAccountsModule.createHandler({ env });
  let capturedParams = null;

  const mailListHandler = accountMailListModule.createHandler({
    env,
    fetchMailListImpl: async (params) => {
      capturedParams = params;
      return [
        {
          send: 'sender@example.com',
          subject: 'Shared Subject',
          text: 'Shared body',
          html: '<p>Shared body</p>',
          date: '2026-04-22T00:00:00.000Z',
        },
      ];
    },
  });

  await invokeHandler(importHandler, {
    method: 'POST',
    body: {
      password: env.PASSWORD,
      rows: [createRows()[0]],
    },
  });

  const listResponse = await invokeHandler(listHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
    },
  });

  const account = listResponse.payload.accounts[0];
  const mailListResponse = await invokeHandler(mailListHandler, {
    method: 'GET',
    query: {
      password: env.PASSWORD,
      accountId: account.id,
      mailbox: 'Junk',
    },
  });

  assert.equal(mailListResponse.statusCode, 200);
  assert.equal(mailListResponse.payload.email, 'alpha@example.com');
  assert.equal(mailListResponse.payload.messages.length, 1);
  assert.deepEqual(capturedParams, {
    refreshToken: 'alpha-refresh',
    clientId: 'alpha-client',
    email: 'alpha@example.com',
    mailbox: 'Junk',
  });
});
