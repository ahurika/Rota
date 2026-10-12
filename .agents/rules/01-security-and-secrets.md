---
trigger: always_on
---

# Rule 01: Security and secrets

**Activation:** Always On.

## Core idea

Anything inside the mobile app is public. Anyone can unzip the Android build, read the bundle, or call the API with Postman. So the app only displays what the server allows. The server decides everything that matters: who the user is, what they paid, what they may see.

## Secrets

1. Never write a real key, password, token, or database URL into any file that is committed.
2. Server secrets live in server environment variables. Local development uses an untracked `.env`. Production uses the host's secret manager.
3. Commit `.env.example` in `server/` and `app/` listing variable names with no values.
4. Any variable starting with `EXPO_PUBLIC_` is bundled into the app and readable by everyone. Only these are allowed: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN_APP`, `EXPO_PUBLIC_EAS_PROJECT_ID`. To add another, update `PRD.md` Appendix A and explain why it is safe.
5. Payment secret keys, webhook secrets, JWT secrets, Redis URLs, and database URLs never appear in the app.
6. Add `.env`, `.env.*` (except `.env.example`), and build output to `.gitignore` before the first commit.
7. If a secret is ever committed, deleting the file is not enough. Tell the human to rotate it at the provider and treat the old one as leaked.

## Server-side authority

1. Every route checks authentication, then team membership, then role, in that order.
2. Never accept `role`, `teamId`, `price`, `amount`, `seats`, or `status` from the client as truth. Read them from the database or compute them on the server.
3. Return 404 (not 403) when a user asks for another team's resource. Do not confirm it exists.
4. Return 403 when the resource is in the user's team but their role is not allowed.
5. Authentication failures return a generic message. Login and password reset never reveal whether an email exists.

## Input validation

1. Validate body, query string, and path params with Zod on every route. Reject unknown fields (`.strict()`).
2. Set maximum lengths on all strings and maximum values on all numbers and page sizes.
3. Never build SQL by string concatenation. Use parameters (`$1`) or the ORM.
4. Escape or reject anything rendered into HTML (the invite landing page).

## Tokens and sessions

1. Passwords: argon2id. Never log passwords or tokens.
2. Access token: JWT, 15 minutes. Refresh token: random 32 bytes, stored only as a hash (SHA-256 with a server pepper), rotated on every use.
3. Reset, magic link, and invite tokens: random, single-use, expiring, stored hashed.
4. Compare secrets and signatures with a constant-time function.
5. Mobile storage: `expo-secure-store` for tokens. Never AsyncStorage.

## Rate limits (Redis, see skill `redis-cache-and-rate-limit`)

Limit login, register, magic link, password reset, invites, and payment endpoints per IP and per user. If Redis is down, these endpoints fail closed (return 503), not open.

## Logging

1. Log request id, user id, team id, route, status, and duration.
2. Never log passwords, tokens, full card data, webhook signatures, or full request bodies for auth and billing routes.
3. Error messages shown to users never include stack traces or SQL.

## Required documentation

`docs/SECURITY.md` lists 8 threats and how each is handled. Start with these and add more:

1. Stolen access token
2. Stolen refresh token (reuse detection)
3. Staff calling manager endpoints directly
4. One team reading another team's data
5. Secret extracted from the app bundle
6. Forged or replayed payment webhook
7. Double charge from a retried payment request
8. Brute force on login, reset, or magic link

## Review checklist (run before every commit that touches an endpoint)

- [ ] Zod schema present and strict
- [ ] Auth, membership, and role checks present
- [ ] Query filters by `team_id`
- [ ] No secret in code, logs, or app
- [ ] Rate limit applied if the endpoint is sensitive
- [ ] Test added for the forbidden case, not only the happy case
