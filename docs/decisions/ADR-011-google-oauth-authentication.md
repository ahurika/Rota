# ADR-011: Google OAuth ID Token Authentication
Date: 2026-10-12   Status: accepted

## Problem
In addition to email/password and magic links, users expect seamless social login with Google on mobile devices. We needed a server-authoritative way to authenticate Google users without trusting unverified client claims or bypassing our rotating refresh token session architecture.

## Options considered
1. **OAuth Web Redirect Flow with Server Redirect URI**:
   - Pros: Standard browser OAuth pattern.
   - Cons: Cumbersome UX inside React Native / Expo apps, requiring deep-link return schemes and cookie handling.
2. **Client-side Google Sign-In with Server ID Token Verification**:
   - Pros: Mobile app uses native Google Sign-In (`expo-auth-session` / Google Credential Manager) to obtain a cryptographically signed Google ID token. The app sends `idToken` to `POST /v1/auth/google`. The server verifies the token against Google's tokeninfo endpoint, checks `email_verified`, extracts the user, and issues Rota's native 15-minute JWT access token + 30-day rotating refresh token.
   - Cons: Requires network call to Google or local public key verification during token check.

## Decision
We chose client-side ID token retrieval with server-side validation (`POST /v1/auth/google`).

## Why
1. Follows Rule 01 (never trust the frontend): The server independently verifies the Google signature and `email_verified` status before issuing any session.
2. Seamlessly reuses Rota's core session security: Google users receive the exact same rotating refresh tokens, session family tracking, and reuse detection (Proof Test T4).
3. Accommodates new users automatically: First-time Google sign-ins automatically create an account with a randomized, unusable password hash.

## Consequences
- The client app only needs to send `{ idToken }` to `/v1/auth/google`.
- Google users can log out, refresh tokens, and log out of all devices identically to password-based users.
