# ADR-004: Authentication, Argon2id, and Rotating Refresh Tokens with Reuse Detection
Date: 2026-10-12   Status: accepted

## Problem
In a mobile application, tokens are stored on user devices. If a refresh token is compromised and never expires or rotates, an attacker gains permanent account access. Conversely, short session lifetimes force users to log in repeatedly, hurting the experience.

## Options considered
1. **Long-lived JWT Access Tokens (30 days)**:
   - Pros: Simple, stateless.
   - Cons: Impossible to revoke immediately without maintaining an unbounded blacklist; severe security risk if stolen.
2. **Standard Non-Rotating Refresh Tokens**:
   - Pros: Standard OAuth pattern.
   - Cons: If the refresh token is leaked, the attacker can silently refresh tokens for weeks without detection.
3. **Short-lived Access Token (15 min) + Rotating Refresh Token (30 days) with Token Family Reuse Detection**:
   - Pros: Compromised access tokens expire in 15 minutes. Every refresh burns the old token and issues a new one. If an attacker replays an old token, the server immediately detects the reuse, invalidates the entire token family, and forces re-authentication.
   - Cons: Requires atomic token swapping in the database to prevent race conditions during rapid concurrent client refreshes.

## Decision
We chose the rotating refresh token strategy with family reuse detection and argon2id password hashing per PRD Section 5.1 and the `auth-and-token-rotation` skill.

## Why
1. Satisfies requirement FR-A3 and FR-A4 with Proof Test T4.
2. The atomic conditional `UPDATE refresh_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL` guarantees that exactly one request claims an unspent token even under high concurrency.
3. Passwords hashed with argon2id protect against GPU/ASIC brute-force dictionary attacks.
4. Token versions (`token_version` on users and `tv:{userId}` in Redis) allow immediate "log out of all devices".

## Consequences
- The client must queue requests during a refresh so it does not send the same refresh token twice.
- If reuse is detected, all sessions for that family are revoked immediately.
