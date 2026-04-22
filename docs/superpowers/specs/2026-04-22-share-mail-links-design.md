# Share Mail Links Design

**Date:** 2026-04-22

**Goal:** Allow the admin to import mailbox accounts into server-side storage, generate long-lived share links for each imported account, and let anyone opening a valid share link view the current mail list for that mailbox without exposing the mailbox password or refresh token.

## Context

The current project stores imported mailbox rows only in the browser `localStorage` on `public/mail.html`. That makes the feature local to one browser session and prevents real sharing. The mail-reading APIs already exist in `api/mail-all.js` and `api/mail-new.js`, but they require raw account credentials in the request, which is unsuitable for public share links.

The project is deployed as a Vercel serverless app, so persistent account data cannot rely on local process memory. Production storage needs an external durable backend. For this design, production uses Upstash Redis via Vercel Marketplace Redis, while local development can use a JSON file fallback for convenience.

## Requirements

### Functional

1. Admin can import one or more accounts into server-side storage from the existing `email----password----clientId----refreshToken` format.
2. Admin can list imported accounts in the existing management page.
3. Admin can delete one account or batch-delete multiple accounts.
4. Admin can reset the share link for a single account.
5. Admin can copy or view a long-lived share link for each account.
6. Opening a valid share link shows the current full mail list for that mailbox.
7. Share links are read-only and do not allow inbox or junk processing actions.
8. Public share access must not expose raw `refreshToken` or imported mailbox passwords.

### Non-Functional

1. Existing mail-fetching behavior should be reused instead of duplicated.
2. Admin APIs remain protected by the existing `PASSWORD` gate.
3. Public share access should fail cleanly with 401 or 404 style errors.
4. Local development should work without provisioning Redis immediately.

## Architecture

### Storage Model

Each imported account is stored as a durable server-side record:

- `id`: stable account id
- `email`
- `password`
- `clientId`
- `refreshToken`
- `shareNonce`
- `createdAt`
- `updatedAt`

`shareNonce` is a random rotation value. The public share token is derived at runtime from `id`, `shareNonce`, and a server secret. This lets the app reproduce the current share URL for admin listing while avoiding storing a reusable public token directly.

### Share Token Strategy

Public share links use:

`/boobar?share=<accountId>.<signature>`

Where:

- `accountId` is the stored account id
- `signature` is an HMAC derived from `accountId + shareNonce` and `SHARE_TOKEN_SECRET`

Benefits:

- Links are long-lived
- Resetting the link only requires rotating `shareNonce`
- The server can regenerate the same current link for admin listing
- The link itself does not expose the mailbox password

### Storage Backend Strategy

Two storage backends are supported behind one shared repository module:

1. `redis` mode
   Uses Upstash Redis through environment variables injected by Vercel Marketplace.
2. `file` mode
   Uses a local JSON file for development and tests when Redis credentials are absent.

The app auto-detects Redis environment variables. If they are missing, it falls back to the JSON file backend.

## Components

### Shared Mail Service

Extract the mail retrieval logic from `api/mail-all.js` into a reusable service module. That service accepts the stored account credentials and a mailbox name and returns the normalized mail list. The existing admin API and the new public share API both call this module.

### Account Repository

A shared repository module owns:

- create/import accounts
- list accounts
- delete one account
- delete many accounts
- lookup account by id
- rotate share nonce
- generate current share link
- validate incoming share tokens

### Admin APIs

Add authenticated admin endpoints:

- `POST /api/accounts/import`
- `GET /api/accounts/list`
- `POST /api/accounts/delete`
- `POST /api/accounts/batch-delete`
- `POST /api/accounts/reset-share`
- `GET /api/accounts/mail-list`

These endpoints accept the existing admin `password` and never return raw refresh tokens to the browser unless strictly necessary. `mail-list` uses `accountId` instead of exposing raw credential fields in the request URL.

### Public Share API

Add:

- `GET /api/share-mail-list?share=...&mailbox=...`

This endpoint validates the share token, loads the account record, and returns the current full mail list using the shared mail service.

### Public Share Page

Add a new public page:

- `public/boobar.html`

The page reads the `share` query parameter, fetches the current mail list from the public API, and renders the result plus mail detail modal behavior.

## UI Changes

### Admin Page

`public/mail.html` keeps the current dashboard and import workflow but changes data flow from browser `localStorage` to admin APIs.

The account table gains a new share-link action area:

- copy share link
- reset share link
- view inbox
- view junk
- delete

The page still stores the admin `password` locally for convenience, but account rows now come from the server.

### Public Page

The public page is intentionally simpler than the admin page:

- shows a loading state
- shows current mailbox email
- shows the full mail list
- shows message detail in a modal
- has no destructive actions

## Error Handling

- Missing or invalid admin password returns 401.
- Invalid import rows are skipped, with the import API reporting counts.
- Missing share token returns 400.
- Invalid or revoked share token returns 401 or 404.
- Empty mailbox returns an empty list, not a broken page.
- Missing storage configuration in production returns a clear server error.

## Testing Strategy

1. Repository tests for file-backed storage and share token validation.
2. Import parsing tests for server-side account creation workflow.
3. API tests for:
   - admin account import
   - admin list
   - share link validation
   - public shared mail list authorization
4. Frontend contract tests for the public page query parsing and rendering helpers where practical.

## Deployment Notes

Production needs:

- `PASSWORD`
- `SHARE_TOKEN_SECRET`
- Upstash Redis environment variables from Vercel Marketplace Redis integration

Local development can run with:

- `PASSWORD`
- `SHARE_TOKEN_SECRET`
- no Redis env vars, using local JSON fallback

## Scope Guardrails

- No public destructive mail actions
- No password-in-URL behavior
- No anonymous account search by email alone
- No expiration logic for share links in this phase
