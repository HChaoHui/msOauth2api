const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchMailList, normalizeMailbox } = require('../api/_lib/mail-service');

test('normalizeMailbox maps inbox and junk values for graph and imap access', () => {
  assert.deepEqual(normalizeMailbox('INBOX'), {
    graphMailbox: 'inbox',
    imapMailbox: 'INBOX',
  });

  assert.deepEqual(normalizeMailbox('Junk'), {
    graphMailbox: 'junkemail',
    imapMailbox: 'Junk',
  });

  assert.deepEqual(normalizeMailbox('unexpected'), {
    graphMailbox: 'inbox',
    imapMailbox: 'INBOX',
  });
});

test('fetchMailList returns normalized graph mail data when graph mail scope is available', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url);

    if (fetchCalls.length === 1) {
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'graph-token',
            scope: 'https://graph.microsoft.com/Mail.Read',
          }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        value: [
          {
            from: {
              emailAddress: {
                address: 'sender@example.com',
              },
            },
            subject: 'Graph Subject',
            bodyPreview: 'Preview text',
            body: {
              content: '<p>Preview text</p>',
            },
            createdDateTime: '2026-04-22T00:00:00.000Z',
          },
        ],
      }),
    };
  };

  const result = await fetchMailList(
    {
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      email: 'shared@example.com',
      mailbox: 'Junk',
    },
    { fetchImpl }
  );

  assert.deepEqual(result, [
    {
      send: 'sender@example.com',
      subject: 'Graph Subject',
      text: 'Preview text',
      html: '<p>Preview text</p>',
      date: '2026-04-22T00:00:00.000Z',
    },
  ]);

  assert.match(fetchCalls[1], /mailFolders\/junkemail\/messages/);
});

test('fetchMailList falls back to imap when graph mail scope is unavailable', async () => {
  const fetchCalls = [];
  const fetchImpl = async () => {
    fetchCalls.push(fetchCalls.length + 1);

    if (fetchCalls.length === 1) {
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'graph-token',
            scope: 'openid profile offline_access',
          }),
      };
    }

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: 'imap-token',
        }),
    };
  };

  let imapParams = null;
  const imapListImpl = async (params) => {
    imapParams = params;
    return [
      {
        send: 'imap@example.com',
        subject: 'IMAP Subject',
        text: 'IMAP body',
        html: '<p>IMAP body</p>',
        date: '2026-04-22T01:00:00.000Z',
      },
    ];
  };

  const result = await fetchMailList(
    {
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      email: 'shared@example.com',
      mailbox: 'INBOX',
    },
    { fetchImpl, imapListImpl }
  );

  assert.deepEqual(result, [
    {
      send: 'imap@example.com',
      subject: 'IMAP Subject',
      text: 'IMAP body',
      html: '<p>IMAP body</p>',
      date: '2026-04-22T01:00:00.000Z',
    },
  ]);
  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(imapParams, {
    accessToken: 'imap-token',
    email: 'shared@example.com',
    mailbox: 'INBOX',
  });
});
