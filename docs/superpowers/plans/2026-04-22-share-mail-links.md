# Share Mail Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable imported-account storage plus long-lived share links so public visitors can open a share URL and view the current full mail list for one mailbox.

**Architecture:** Introduce a shared account repository with Redis-or-file persistence, extract mail fetching into a reusable server module, and switch the admin UI from browser-local storage to authenticated account APIs. Public share access is served by a dedicated page and a token-validated read-only API.

**Tech Stack:** Node.js CommonJS, Vercel serverless functions, `node:test`, browser Fetch API, Upstash Redis in production with local JSON fallback.

---

### Task 1: Create the storage and token foundation

**Files:**
- Create: `api/_lib/account-store.js`
- Create: `api/_lib/share-token.js`
- Create: `tests/account-store.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFileAccountStore } = require('../api/_lib/account-store');
const { createShareTokenService } = require('../api/_lib/share-token');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/account-store.test.js`
Expected: FAIL because `api/_lib/account-store.js` and `api/_lib/share-token.js` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- file-backed account CRUD
- `shareNonce` rotation
- deterministic share token generation and validation

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/account-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/account-store.js api/_lib/share-token.js tests/account-store.test.js
git commit -m "feat: add account storage foundation"
```

### Task 2: Extract reusable mail fetching

**Files:**
- Create: `api/_lib/mail-service.js`
- Modify: `api/mail-all.js`
- Create: `tests/mail-service.test.js`

- [ ] **Step 1: Write the failing test**

Add tests that expect a normalized mail list response from a shared `fetchMailList` function and validate mailbox normalization separately from HTTP handlers.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mail-service.test.js`
Expected: FAIL because the shared mail service does not exist.

- [ ] **Step 3: Write minimal implementation**

Move shared Graph-or-IMAP list logic into `api/_lib/mail-service.js`, then rewrite `api/mail-all.js` to call the shared function.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mail-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/mail-service.js api/mail-all.js tests/mail-service.test.js
git commit -m "refactor: extract shared mail list service"
```

### Task 3: Add admin account management APIs

**Files:**
- Create: `api/accounts/import.js`
- Create: `api/accounts/list.js`
- Create: `api/accounts/delete.js`
- Create: `api/accounts/batch-delete.js`
- Create: `api/accounts/reset-share.js`
- Create: `api/accounts/mail-list.js`
- Create: `api/_lib/admin-auth.js`
- Create: `tests/accounts-api.test.js`

- [ ] **Step 1: Write the failing tests**

Cover:
- import stores parsed rows
- list returns server-side rows with share links
- delete and batch-delete remove records
- reset-share changes the share link
- mail-list fetches by `accountId` behind admin password

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/accounts-api.test.js`
Expected: FAIL because the new API handlers do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement small handlers that:
- validate admin password
- call the repository
- return JSON responses usable by `public/mail.html`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/accounts-api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/accounts api/_lib/admin-auth.js tests/accounts-api.test.js
git commit -m "feat: add admin account management APIs"
```

### Task 4: Add public share API and page

**Files:**
- Create: `api/share-mail-list.js`
- Create: `public/boobar.html`
- Modify: `vercel.json`
- Create: `tests/share-mail-api.test.js`

- [ ] **Step 1: Write the failing tests**

Cover:
- valid share token returns mail list
- invalid share token is rejected
- missing share token returns 400

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/share-mail-api.test.js`
Expected: FAIL because the public API does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement:
- public token validation
- read-only mail-list API
- static `boobar.html`
- Vercel rewrite from `/boobar` to `/boobar.html`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/share-mail-api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/share-mail-list.js public/boobar.html vercel.json tests/share-mail-api.test.js
git commit -m "feat: add shared mail list page"
```

### Task 5: Switch the admin UI to server-backed data

**Files:**
- Modify: `public/mail.html`
- Create: `tests/mail-admin-page.test.js`

- [ ] **Step 1: Write the failing test**

Add assertions that the page references share-link actions and no longer depends on `localStorage` for account rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mail-admin-page.test.js`
Expected: FAIL because the page still uses local `emailData`.

- [ ] **Step 3: Write minimal implementation**

Change the page so it:
- loads rows from `/api/accounts/list`
- imports through `/api/accounts/import`
- deletes through new account APIs
- opens mail list through `/api/accounts/mail-list`
- exposes copy/reset share actions

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mail-admin-page.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/mail.html tests/mail-admin-page.test.js
git commit -m "feat: switch admin UI to server-backed accounts"
```

### Task 6: Verify end-to-end behavior

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the focused test suite**

Run: `node --test tests/account-store.test.js tests/mail-service.test.js tests/accounts-api.test.js tests/share-mail-api.test.js tests/mail-admin-page.test.js tests/mail-import.test.js`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `node --test tests/*.test.js`
Expected: PASS

- [ ] **Step 3: Update deployment docs**

Document:
- new share-link behavior
- required env vars
- local JSON fallback vs Redis production mode

- [ ] **Step 4: Re-run the full test suite**

Run: `node --test tests/*.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document share mail links"
```
