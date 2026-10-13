# Rota Security Specification & Threat Model

This document specifies the security architecture for Rota and evaluates the 8 primary threat vectors required by PRD Section 7, Section 11, and Rule 01.

---

## 1. Security Philosophy: Zero Trust in the Client

1. **Client is Public and Untrusted**: Anything inside the mobile app bundle is public. Anyone can decompile the Android APK, extract strings, inspection tools, or query the backend API directly via Postman or curl.
2. **Server-Side Authority**: Every permission, membership, seat limit, billing state, and price calculation is strictly decided and enforced on the server. The client is only a presentation layer.
3. **No Secrets in Bundles**: Only explicitly whitelisted `EXPO_PUBLIC_` variables (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN_APP`, `EXPO_PUBLIC_EAS_PROJECT_ID`) are permitted in the client. Database URLs, JWT secrets, peppers, and payment private keys reside purely in server environment variables.
4. **Parameterization & Validation**: All incoming requests (params, query, body) are strictly validated with Zod schemas (`.strict()`). All database queries use parameterized SQL or Prisma ORM to eliminate SQL injection.

---

## 2. Threat Model: 8 Core Threat Vectors

### Threat 1: Stolen Access Token
- **Risk**: An attacker intercepts or extracts an active JWT access token from memory or network transit and attempts unauthorized API calls.
- **Mitigation**:
  - Access tokens are strictly short-lived (15 minutes).
  - Every access token contains the user's `tokenVersion`. If a user logs out of all devices or resets their password, `token_version` is bumped in the database, invalidating all outstanding access tokens within the documented window.
  - Access tokens are stored on mobile using `expo-secure-store` (hardware-backed keystore/keychain), never insecure `AsyncStorage`.
  - Sensitive operations (billing changes, deleting teams, adding members) require team-level role authorization checked against the database.

### Threat 2: Stolen Refresh Token (Reuse Detection)
- **Risk**: An adversary steals a 30-day refresh token from a compromised device and attempts to exchange it for new credentials.
- **Mitigation & Proof (Test T4)**:
  - Refresh tokens are single-use and rotated on every exchange.
  - Raw tokens are never stored in the database; only a SHA-256 hash combined with a server pepper (`REFRESH_TOKEN_PEPPER`) is stored.
  - **Token Families**: Each refresh token belongs to a `family_id`.
  - **Reuse Detection**: If a used refresh token is presented again (indicating that both the legitimate user and an attacker hold the token), the server immediately revokes the **entire token family** (`revoked_at = now()`), forcing re-authentication on all devices in that family.
  - Verified by **Proof Test T4** (`server/test/integration/token_rotation_t4.test.ts`).

### Threat 3: Staff Calling Manager/Owner Endpoints Directly
- **Risk**: A malicious employee with a valid Staff JWT crafts HTTP requests (e.g., via Postman) to `DELETE /teams/:teamId/shifts/:shiftId` or modify billing settings.
- **Mitigation & Proof (Test T1)**:
  - Role checks are enforced by server-side middleware (`requireRole('manager')` or `requireRole('owner')`) prior to executing route handlers.
  - The middleware reads the caller's membership from the database or verified directory and compares their role against the RBAC permission matrix (PRD Section 2.1).
  - Calling a protected endpoint with insufficient privileges immediately returns `HTTP 403 Forbidden` and leaves the database records untouched.
  - Verified by **Proof Test T1** (`server/test/integration/rbac_t1.test.ts`).

### Threat 4: Cross-Tenant Data Access (Team Isolation)
- **Risk**: A user from Team A attempts to view or modify shifts, rosters, or subscriptions belonging to Team B by guessing or enumerating `teamId` or `shiftId`.
- **Mitigation & Proof (Test T2)**:
  - Tenant isolation middleware verifies that the authenticated user is an active member of the target `teamId`.
  - If a user attempts to access resources from a team they do not belong to, the server responds with **`HTTP 404 Not Found`** rather than `403 Forbidden`. This deliberately conceals the existence of other tenants and eliminates enumeration attacks.
  - Every single database query for team-scoped resources includes `WHERE team_id = $1`.
  - Verified by **Proof Test T2** (`server/test/integration/isolation_t2.test.ts`).

### Threat 5: Secrets Extracted from Mobile App Bundle
- **Risk**: A reverse engineer decompiles the Android APK (`apktool` / `jadx`) searching for API keys, payment provider secrets, or database credentials.
- **Mitigation**:
  - The mobile bundle contains zero private credentials.
  - `.env` files are ignored by git (`.gitignore`).
  - Only `EXPO_PUBLIC_` variables are included in the bundle, strictly restricted to:
    - `EXPO_PUBLIC_API_URL` (public domain)
    - `EXPO_PUBLIC_SENTRY_DSN_APP` (write-only ingestion DSN)
    - `EXPO_PUBLIC_EAS_PROJECT_ID` (public build project identifier)
  - Payment initiation is conducted via backend-authenticated endpoints (`/v1/teams/:teamId/billing/checkout`), which generate server-side hosted checkout links. Secret keys (`PAYSTACK_SECRET_KEY`, `FLW_SECRET_KEY`) never touch the client.

### Threat 6: Forged or Replayed Payment Webhook
- **Risk**: An attacker attempts to forge payment success webhooks to grant unpaid subscriptions, or replays legitimate webhooks to trigger duplicate balance credits.
- **Mitigation & Proof (Tests T5 & T6)**:
  - **HMAC Signature Verification**: Every webhook request requires a cryptographic HMAC-SHA512 signature in the header (`x-paystack-signature` or `verif-hash`) computed over the raw request body using `WEBHOOK_SECRET`. Requests with invalid signatures are rejected with `HTTP 401 Unauthorized` and record zero database changes (**Proof Test T6**).
  - **Constant-Time Comparison**: Signatures are evaluated using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
  - **Idempotent Webhook Log**: Webhooks are logged in `webhook_events` with unique constraints on `(provider, event_id)`. If an event is retransmitted 3 times, duplicate events are ignored and exactly one ledger row is created (**Proof Test T5**).
  - Verified by **Proof Tests T5 & T6** (`server/test/integration/billing_webhook_t5_t6.test.ts`).

### Threat 7: Double Charge from Retried Payment Request
- **Risk**: Network instability causes a client to retry a subscription charge request, potentially charging the customer twice.
- **Mitigation & Proof (Test T7)**:
  - The billing initiation endpoints (`/billing/change`, `/billing/checkout`) require an `Idempotency-Key` header.
  - Idempotency middleware checks the `idempotency_keys` table.
  - If a duplicate `Idempotency-Key` is received with an identical payload, the cached prior response is immediately returned without re-executing payment charges or ledger writes.
  - If the same key is reused with a different request payload, the server returns `HTTP 422 Unprocessable Entity`.
  - Verified by **Proof Test T7** (`server/test/integration/idempotency_t7.test.ts`).

### Threat 8: Brute-Force Attacks on Auth, Password Reset, and Invites
- **Risk**: Automated bots attempt credential stuffing or brute-force token guessing against `/auth/login`, `/auth/password-reset/request`, `/auth/magic-link`, or invite acceptance.
- **Mitigation & Proof (Test T13)**:
  - **Argon2id Hashing**: Passwords use argon2id (memory-hard, resistant to GPU/ASIC cracking).
  - **Redis Atomic Fixed-Window Rate Limiting**: Sensitive auth endpoints are limited by IP address and user identifier via Redis Lua scripts.
  - **Fail-Closed Architecture**: If Redis is offline, sensitive authentication and billing endpoints fail closed (`HTTP 503 Service Unavailable`), preventing brute-force bypass during outages.
  - **Generic Responses**: Login, password reset, and magic link endpoints always return generic responses regardless of whether the email exists, preventing user enumeration.
  - **Single-Use Tokens**: Magic links, invite links, and password reset tokens are single-use, 15-to-30 minute expiring, and stored as SHA-256 hashes.
  - Verified by **Proof Test T13** (`server/test/integration/rate_limit_t13.test.ts`).

---

## 3. Database Security & Ledger Immutability (Proof Test T11)

To ensure financial auditability:
- The `ledger_entries` table is append-only.
- A PostgreSQL database trigger (`prevent_ledger_mutation`) explicitly raises an exception on any `UPDATE`, `DELETE`, or `TRUNCATE` operations on `ledger_entries`.
- Verified by **Proof Test T11** (`server/test/integration/ledger_t11_t12.test.ts`).

---

## 4. Verification Matrix

| Threat ID | Requirement | Test ID | Verification File | Status |
|---|---|---|---|---|
| T1 | RBAC: Staff cannot delete shift | T1 | `server/test/integration/rbac_t1.test.ts` | **PASSED** |
| T2 | Isolation: Cross-team returns 404 | T2 | `server/test/integration/isolation_t2.test.ts` | **PASSED** |
| T3 | Money: Exact integer proration | T3 | `server/test/unit/proration_t3.test.ts` | **PASSED** |
| T4 | Auth: Refresh token reuse revokes family | T4 | `server/test/integration/token_rotation_t4.test.ts` | **PASSED** |
| T5 | Webhook: Idempotent processing | T5 | `server/test/integration/billing_webhook_t5_t6.test.ts` | **PASSED** |
| T6 | Webhook: Invalid signature returns 401 | T6 | `server/test/integration/billing_webhook_t5_t6.test.ts` | **PASSED** |
| T7 | Payment: Idempotency-Key prevents double charge | T7 | `server/test/integration/idempotency_t7.test.ts` | **PASSED** |
| T8 | Multi-Tenancy: Starter seat limit (5 max) | T8 | `server/test/integration/seats_t8.test.ts` | **PASSED** |
| T11 | Ledger: Mutation blocked by DB trigger | T11 | `server/test/integration/ledger_t11_t12.test.ts` | **PASSED** |
| T13 | DoS / Brute-Force: Rate limit returns 429 | T13 | `server/test/integration/rate_limit_t13.test.ts` | **PASSED** |
