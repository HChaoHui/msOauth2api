# Baota Redis Docker Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standard Redis support plus Docker deployment files so this project can run on a Baota-managed server with a Redis instance and reverse proxy.

**Architecture:** Keep the current account-store abstraction, add a standard Redis-backed implementation selected by environment variables, and retain the existing Upstash/file fallbacks. Package the existing local Node server for containers, bind it to a configurable host, and document a Baota deployment path using Cloudflare plus panel-level reverse proxy.

**Tech Stack:** Node.js, Redis (`redis` npm package), Docker, docker-compose

---

### Task 1: Add failing tests for standard Redis storage selection

**Files:**
- Modify: `tests/account-store.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('account store factory uses standard Redis storage when Redis connection env vars exist', async () => {
  const state = new Map();
  const client = {
    async connect() {},
    async get(key) {
      return state.get(key) ?? null;
    },
    async set(key, value) {
      state.set(key, value);
    },
    async quit() {},
  };

  const store = createAccountStoreFromEnv({
    env: {
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'secret',
    },
    createRedisClientImpl: () => client,
  });

  await store.importAccounts([createAccount('redis@example.com', 'redis')]);
  const accounts = await store.listAccounts();

  assert.equal(accounts[0].email, 'redis@example.com');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/account-store.test.js`
Expected: FAIL because `createAccountStoreFromEnv` does not yet support standard Redis env vars.

- [ ] **Step 3: Write minimal implementation**

```js
module.exports = {
  createAccountStoreFromEnv({ env = process.env, fetchImpl = fetch, createRedisClientImpl } = {}) {
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      return createUpstashAccountStore({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN, fetchImpl });
    }

    if (env.REDIS_URL || env.REDIS_HOST) {
      return createRedisAccountStore({ env, createRedisClientImpl });
    }

    return createFileAccountStore({ filePath: env.ACCOUNT_STORE_FILE || path.join(process.cwd(), 'data', 'accounts.json') });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/account-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/account-store.test.js api/_lib/account-store.js
git commit -m "feat: add standard redis account storage"
```

### Task 2: Add runtime support for standard Redis account persistence

**Files:**
- Modify: `api/_lib/account-store.js`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing test**

```js
test('redis account store reuses persisted snapshot between calls', async () => {
  const state = new Map();
  const client = {
    async connect() {},
    async get(key) {
      return state.get(key) ?? null;
    },
    async set(key, value) {
      state.set(key, value);
    },
    async quit() {},
  };

  const store = createRedisAccountStore({
    createRedisClientImpl: () => client,
    redisOptions: {},
  });

  await store.importAccounts([createAccount('first@example.com', 'first')]);
  const listed = await store.listAccounts();
  assert.equal(listed.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/account-store.test.js`
Expected: FAIL because `createRedisAccountStore` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```js
function createRedisAccountStore({ redisOptions, createRedisClientImpl = createClient, key = REDIS_STORE_KEY }) {
  async function withClient(run) {
    const client = createRedisClientImpl(redisOptions);
    await client.connect();
    try {
      return await run(client);
    } finally {
      await client.quit();
    }
  }

  return createAccountStore({
    loadAccounts: () => withClient(async (client) => parseSnapshot(await client.get(key))),
    saveAccounts: (accounts) => withClient(async (client) => client.set(key, stringifySnapshot(accounts))),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/account-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/account-store.js package.json package-lock.json tests/account-store.test.js
git commit -m "feat: support standard redis account storage"
```

### Task 3: Make the local server container-friendly

**Files:**
- Modify: `scripts/local-dev-server.js`

- [ ] **Step 1: Write the failing test**

```js
assert.equal(process.env.HOST ?? '0.0.0.0', '0.0.0.0');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: No dedicated server host behavior exists yet.

- [ ] **Step 3: Write minimal implementation**

```js
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
  console.log(`local dev server listening on http://${host}:${port}`);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/local-dev-server.js
git commit -m "fix: bind local server to configurable host"
```

### Task 4: Add Docker deployment assets

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yml`

- [ ] **Step 1: Write the failing test**

```js
assert.ok(fs.existsSync(path.join(process.cwd(), 'Dockerfile')));
assert.ok(fs.existsSync(path.join(process.cwd(), 'docker-compose.yml')));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL because Docker deployment files do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "scripts/local-dev-server.js"]
```

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose config`
Expected: exit code 0

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml
git commit -m "feat: add docker deployment files"
```

### Task 5: Document Baota deployment with Redis

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing test**

```js
assert.match(readme, /Docker/i);
assert.match(readme, /Redis/i);
assert.match(readme, /Baota|宝塔/i);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vercel-config.test.js`
Expected: FAIL because the README does not yet explain Docker plus standard Redis deployment.

- [ ] **Step 3: Write minimal implementation**

```md
## Docker 部署（宝塔）

使用 `docker-compose.yml` 部署应用容器，并通过 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD` 连接宝塔 Redis。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add baota docker deployment guide"
```
