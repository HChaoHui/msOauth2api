const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const UPSTASH_STORE_KEY = 'mail_share_accounts_v1';

function createAccountId() {
  return `acct_${crypto.randomUUID().replace(/-/g, '')}`;
}

function createShareNonce() {
  return `nonce_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function ensureStoreFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, JSON.stringify({ accounts: [] }, null, 2), 'utf8');
  }
}

async function readAccounts(filePath) {
  await ensureStoreFile(filePath);
  const raw = await fs.readFile(filePath, 'utf8');
  return parseSnapshot(raw);
}

async function writeAccounts(filePath, accounts) {
  await ensureStoreFile(filePath);
  await fs.writeFile(filePath, stringifySnapshot(accounts), 'utf8');
}

function sortAccounts(accounts) {
  return [...accounts].sort((left, right) => {
    return String(right.updatedAt).localeCompare(String(left.updatedAt));
  });
}

function normalizeImportedRow(row) {
  return {
    email: row.email.trim(),
    password: row.password.trim(),
    clientId: row.clientId.trim(),
    refreshToken: row.refreshToken.trim(),
  };
}

function parseSnapshot(rawSnapshot) {
  if (!rawSnapshot) {
    return [];
  }

  const parsed = JSON.parse(rawSnapshot || '{"accounts":[]}');
  return Array.isArray(parsed.accounts) ? parsed.accounts : [];
}

function stringifySnapshot(accounts) {
  return JSON.stringify({ accounts }, null, 2);
}

function createAccountStore({ loadAccounts, saveAccounts }) {
  return {
    async importAccounts(rows) {
      const accounts = await loadAccounts();
      let importedCount = 0;

      for (const rawRow of rows) {
        if (!rawRow?.email || !rawRow?.password || !rawRow?.clientId || !rawRow?.refreshToken) {
          continue;
        }

        const row = normalizeImportedRow(rawRow);
        const timestamp = new Date(Date.now() + importedCount).toISOString();
        const existingIndex = accounts.findIndex((account) => account.email === row.email);

        if (existingIndex >= 0) {
          const existing = accounts[existingIndex];
          accounts[existingIndex] = {
            ...existing,
            ...row,
            updatedAt: timestamp,
          };
        } else {
          accounts.push({
            id: createAccountId(),
            ...row,
            shareNonce: createShareNonce(),
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }

        importedCount += 1;
      }

      await saveAccounts(accounts);

      return {
        importedCount,
        accounts: sortAccounts(accounts),
      };
    },

    async listAccounts() {
      const accounts = await loadAccounts();
      return sortAccounts(accounts);
    },

    async getAccountById(accountId) {
      const accounts = await loadAccounts();
      return accounts.find((account) => account.id === accountId) || null;
    },

    async deleteAccount(accountId) {
      const accounts = await loadAccounts();
      const remainingAccounts = accounts.filter((account) => account.id !== accountId);
      await saveAccounts(remainingAccounts);
    },

    async deleteAccounts(accountIds) {
      const idSet = new Set(accountIds);
      const accounts = await loadAccounts();
      const remainingAccounts = accounts.filter((account) => !idSet.has(account.id));
      await saveAccounts(remainingAccounts);
    },

    async rotateShareNonce(accountId) {
      const accounts = await loadAccounts();
      const accountIndex = accounts.findIndex((account) => account.id === accountId);

      if (accountIndex < 0) {
        return null;
      }

      const updatedAccount = {
        ...accounts[accountIndex],
        shareNonce: createShareNonce(),
        updatedAt: new Date().toISOString(),
      };

      accounts[accountIndex] = updatedAccount;
      await saveAccounts(accounts);
      return updatedAccount;
    },
  };
}

function createFileAccountStore({ filePath }) {
  if (!filePath) {
    throw new Error('filePath is required');
  }

  return createAccountStore({
    async loadAccounts() {
      return readAccounts(filePath);
    },
    async saveAccounts(accounts) {
      await writeAccounts(filePath, accounts);
    },
  });
}

function createUpstashAccountStore({
  url,
  token,
  fetchImpl = fetch,
  key = UPSTASH_STORE_KEY,
}) {
  if (!url || !token) {
    throw new Error('Upstash url and token are required');
  }

  async function readRemoteSnapshot() {
    const response = await fetchImpl(`${url}/get/${key}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to read remote account store: ${response.status}`);
    }

    const payload = await response.json();
    return parseSnapshot(payload.result);
  }

  async function writeRemoteSnapshot(accounts) {
    const response = await fetchImpl(`${url}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: stringifySnapshot(accounts),
    });

    if (!response.ok) {
      throw new Error(`Failed to write remote account store: ${response.status}`);
    }
  }

  return createAccountStore({
    loadAccounts: readRemoteSnapshot,
    saveAccounts: writeRemoteSnapshot,
  });
}

module.exports = {
  createAccountStoreFromEnv({ env = process.env, fetchImpl = fetch } = {}) {
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      return createUpstashAccountStore({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
        fetchImpl,
      });
    }

    return createFileAccountStore({
      filePath:
        env.ACCOUNT_STORE_FILE ||
        path.join(process.cwd(), 'data', 'accounts.json'),
    });
  },
  createFileAccountStore,
  createUpstashAccountStore,
};
