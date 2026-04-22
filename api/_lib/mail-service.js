const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

function normalizeMailbox(mailbox) {
  if (mailbox === 'Junk') {
    return {
      graphMailbox: 'junkemail',
      imapMailbox: 'Junk',
    };
  }

  return {
    graphMailbox: 'inbox',
    imapMailbox: 'INBOX',
  };
}

async function readJsonResponse(response) {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse JSON: ${parseError.message}, response: ${responseText}`);
  }
}

async function requestAccessToken(fetchImpl, refreshToken, clientId, extraParams = {}) {
  const response = await fetchImpl(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        ...extraParams,
      }).toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
  }

  return readJsonResponse(response);
}

async function requestGraphAccess(fetchImpl, refreshToken, clientId) {
  const data = await requestAccessToken(fetchImpl, refreshToken, clientId, {
    scope: 'https://graph.microsoft.com/.default',
  });

  return {
    accessToken: data.access_token,
    hasMailScope: typeof data.scope === 'string' &&
      data.scope.includes('https://graph.microsoft.com/Mail.Read'),
  };
}

function normalizeGraphMessage(item) {
  return {
    send: item?.from?.emailAddress?.address || '',
    subject: item?.subject || '',
    text: item?.bodyPreview || '',
    html: item?.body?.content || '',
    date: item?.createdDateTime || '',
  };
}

async function fetchGraphMailList(fetchImpl, accessToken, graphMailbox) {
  const response = await fetchImpl(
    `https://graph.microsoft.com/v1.0/me/mailFolders/${graphMailbox}/messages?$top=10000`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
  }

  const responseData = await response.json();
  const emails = Array.isArray(responseData.value) ? responseData.value : [];
  return emails.map(normalizeGraphMessage);
}

function generateAuthString(user, accessToken) {
  const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
  return Buffer.from(authString).toString('base64');
}

async function defaultImapListImpl({ accessToken, email, mailbox }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      xoauth2: generateAuthString(email, accessToken),
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    });

    const emailList = [];

    imap.once('ready', async () => {
      try {
        await new Promise((innerResolve, innerReject) => {
          imap.openBox(mailbox, true, (error, box) => {
            if (error) {
              return innerReject(error);
            }

            innerResolve(box);
          });
        });

        const results = await new Promise((innerResolve, innerReject) => {
          imap.search(['ALL'], (error, found) => {
            if (error) {
              return innerReject(error);
            }

            innerResolve(found);
          });
        });

        if (!results.length) {
          imap.end();
          return resolve([]);
        }

        const fetchResult = imap.fetch(results, { bodies: '' });

        fetchResult.on('message', (message) => {
          message.on('body', (stream) => {
            simpleParser(stream, (error, mail) => {
              if (error) {
                return reject(error);
              }

              emailList.push({
                send: mail?.from?.text || '',
                subject: mail?.subject || '',
                text: mail?.text || '',
                html: mail?.html || '',
                date: mail?.date || '',
              });
            });
          });
        });

        fetchResult.once('error', (error) => {
          imap.end();
          reject(error);
        });

        fetchResult.once('end', () => {
          imap.end();
        });
      } catch (error) {
        imap.end();
        reject(error);
      }
    });

    imap.once('error', (error) => {
      reject(error);
    });

    imap.once('end', () => {
      resolve(emailList);
    });

    imap.connect();
  });
}

async function fetchMailList(
  { refreshToken, clientId, email, mailbox },
  { fetchImpl = fetch, imapListImpl = defaultImapListImpl } = {}
) {
  if (!refreshToken || !clientId || !email || !mailbox) {
    throw new Error('Missing required parameters: refreshToken, clientId, email, or mailbox');
  }

  const { graphMailbox, imapMailbox } = normalizeMailbox(mailbox);
  const graphAccess = await requestGraphAccess(fetchImpl, refreshToken, clientId);

  if (graphAccess.hasMailScope) {
    return fetchGraphMailList(fetchImpl, graphAccess.accessToken, graphMailbox);
  }

  const imapAccess = await requestAccessToken(fetchImpl, refreshToken, clientId);
  return imapListImpl({
    accessToken: imapAccess.access_token,
    email,
    mailbox: imapMailbox,
  });
}

module.exports = {
  fetchMailList,
  normalizeMailbox,
};
