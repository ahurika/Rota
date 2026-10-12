---
name: auth-and-token-rotation
description: Use when building or changing sign up, login, magic link, refresh tokens, logout, logout of all devices, password reset, or invite tokens in Rota. Covers argon2id, JWT access tokens, rotating refresh tokens with reuse detection, secure-store on the app, and single-use tokens.
---

# Auth and token rotation

## What you are building

| Piece | Rule |
|---|---|
| Password | argon2id hash. Zod: min 10 chars, max 128 |
| Access token | JWT, 15 minutes, claims: `sub` (user id), `sid` (token family id), `tv` (token version) |
| Refresh token | Random 32 bytes (base64url). Server stores only `sha256(token + pepper)`. 30 day expiry. Rotated on every use |
| Magic link | Random token, single use, 15 minutes, stored hashed, delivered by an email job |
| Password reset | Random token, single use, 30 minutes, stored hashed. Success revokes all sessions |
| Invite token | Random token, single use, 7 days, stored hashed, counts toward seats while pending |
| App storage | `expo-secure-store` for both tokens. Never AsyncStorage |

## Why rotation matters (explain this to yourself)

A refresh token is a long-lived key. If it is stolen and never rotates, the thief has 30 days. With rotation, every use swaps the token for a new one. If the real user and the thief both use the same old token, the second use is a replay. The server sees a token that is already marked used and knows something is wrong, so it revokes the whole family and forces login.

## Tables

```
refresh_tokens(id uuid pk, user_id, family_id, device_id, token_hash unique,
               expires_at, used_at null, revoked_at null, replaced_by null, created_at)
users(id, email citext unique, password_hash, token_version int default 0, ...)
```

## Refresh algorithm (copy this logic, then explain it)

```
POST /v1/auth/refresh  { refreshToken, deviceId }
1. hash = sha256(refreshToken + PEPPER)
2. row = SELECT * FROM refresh_tokens WHERE token_hash = hash
3. if no row -> 401 INVALID_REFRESH
4. if row.revoked_at or row.expires_at < now -> 401 INVALID_REFRESH
5. if row.used_at is not null ->
     // REUSE DETECTED: someone replayed an old token
     UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = row.family_id
     log warn "refresh_reuse_detected" {userId, familyId}
     -> 401 REFRESH_REUSED
6. BEGIN
     // atomic claim: only one concurrent request can win
     UPDATE refresh_tokens SET used_at = now()
       WHERE id = row.id AND used_at IS NULL RETURNING id
     if zero rows -> ROLLBACK, treat as reuse (step 5)
     insert new refresh token (same family_id), set replaced_by on old row
   COMMIT
7. issue new access token with current users.token_version
8. return { accessToken, refreshToken }
```

The conditional `UPDATE ... WHERE used_at IS NULL` is what makes the claim atomic. Two requests with the same token cannot both succeed.

## Logout and logout of all devices

- **Logout:** revoke the current family, delete this device's push token.
- **Logout all:** `UPDATE users SET token_version = token_version + 1`, revoke all families for the user, delete all device push tokens, write `SET tv:{userId} <new version>` in Redis.
- **Auth middleware:** verify the JWT, then compare `tv` with the current version (read `tv:{userId}` from Redis, fall back to the database and refill Redis). Reject if lower. This makes old access tokens stop working immediately instead of waiting up to 15 minutes. If Redis is down, read the database.
- Document the trade-off: this adds one Redis read per request. Without it, a stolen access token works until it expires (at most 15 minutes).

## Magic link flow

1. `POST /auth/magic-link { email }` always returns the same 202 message. Rate limit by IP and by email.
2. If the user exists (or you allow sign-in-or-create), create a token and enqueue an email job. The link is `https://<APP_BASE_URL>/m/<token>`. That page redirects to `rota://magic/<token>`.
3. The app calls `POST /auth/magic-link/verify { token }`. Server hashes it, finds an unused unexpired row, marks it used in the same statement (`UPDATE ... WHERE used_at IS NULL RETURNING`), then issues tokens.

## Password reset flow

1. Request endpoint always answers: "If that email exists, we sent a link."
2. Confirm endpoint: validate token, set new password hash, mark token used, revoke all sessions, bump `token_version`.

## Invite flow (see also `eas-build-and-deep-links`)

1. Owner or manager calls `POST /teams/:id/invites { email, role }`. Server checks role permission, seat limit (active members plus pending invites), then stores a hashed token and enqueues the email.
2. The email link opens the app at `rota://invite/<token>`. If the app is not signed in, it stores the token (in memory, not logged) and goes to login or register, then calls `POST /invites/accept { token }`.
3. Accept: in one transaction, verify token and expiry, re-check the seat limit, create the membership with the invited role, write `team_directory`, mark the invite used, write an activity event.
4. Managers can only invite staff. Owner can invite any role.

## Mobile side

- Save tokens with `SecureStore.setItemAsync`. Read at startup. Delete on logout.
- API client refreshes once on 401 and queues parallel requests behind one refresh call so the app never sends the same refresh token twice.
- If refresh returns `REFRESH_REUSED` or `INVALID_REFRESH`, clear everything and show login.

## Tests to write

- T4: replay a used refresh token. Expect 401 and the whole family revoked (check the database).
- Two parallel refreshes with the same token: exactly one succeeds.
- Magic link, reset token, invite token: second use fails; expired token fails.
- Login with wrong password and unknown email return the same error text and similar timing.
- Logout all: old access token is rejected right away.

## Explain-back questions for the human

1. Why do we store a hash of the refresh token instead of the token?
2. What does `WHERE used_at IS NULL` protect against?
3. After "log out of all devices", why does the old access token stop working?
