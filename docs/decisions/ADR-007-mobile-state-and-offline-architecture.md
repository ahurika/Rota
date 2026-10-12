# ADR-007: Mobile State Architecture and Offline Cache Strategy
Date: 2026-10-12   Status: accepted

## Problem
A shift worker mobile application operates under intermittent connectivity (hospital basements, subways, airplane mode) and handles concurrent API calls, sensitive session tokens, and dynamic scheduling. A naive mobile state approach leads to:
1. **Unsynchronized State**: Duplicating server entities into global client stores (e.g. Redux or Zustand) causes divergence, synchronization bugs, and memory leaks.
2. **Security Vulnerabilities**: Storing JWT access/refresh tokens in unencrypted `AsyncStorage` or `MMKV` exposes credentials to extraction via ADB or device backup exploits.
3. **Token Reuse Lockouts**: If multiple background queries receive `401 Unauthorized` simultaneously, triggering separate refresh requests causes race conditions where the second refresh sends a revoked token, causing the server's reuse detection mechanism to invalidate the session entirely.
4. **Stale/Corrupted Persistence**: Blindly persisting the entire React Query cache offline leaks billing secrets or locks the app in stale, unrecoverable states.

## Options considered
1. **Redux / Global Store for Everything**:
   - Pros: Familiar pattern.
   - Cons: Huge boilerplate; violates single-source-of-truth; manual loading/error/cache expiry management.
2. **AsyncStorage for All Tokens and Cache**:
   - Pros: Simple key-value storage.
   - Cons: Unencrypted on disk, violates Rule 01 and Rule 04 security standards.
3. **Hybrid Architecture (Rule 04 Standard)**:
   - **Server State**: Managed exclusively by TanStack Query (`@tanstack/react-query`) with automatic background refetching, window focus sync, and query invalidation.
   - **Client-Only State**: Lightweight Zustand store for transient UI state (active tab, draft swap notes, filter modal visibility, banner dismissals).
   - **Credentials & Secrets**: Managed strictly by `expo-secure-store` backed by Android Keystore / Encrypted SharedPreferences.
   - **Offline Cache**: `@tanstack/query-async-storage-persister` with a strict whitelist (`shouldDehydrateQuery`) preserving ONLY `shifts` and `roster`.
   - **In-Flight Refresh Coalescing**: `ApiClient` coalesces concurrent 401 refresh calls onto a single in-flight promise.

## Decision
We adopted the Hybrid Architecture according to Rule 04 and documented it in `docs/STATE.md`.

## Why
1. **Integrity & Zero Divergence**: TanStack Query handles server truth without copying into Zustand.
2. **Security by Default**: Hardware-backed Keystore storage for tokens; AsyncStorage never contains tokens or billing data.
3. **Resilient Offline UX**: Shifts and roster are cached for 24 hours, enabling shift workers to check upcoming shifts in airplane mode with explicit "Last updated" timestamps and NetInfo offline banners.
4. **Race-Free Token Rotation**: Single-promise coalescing prevents concurrent 401s from triggering reuse detection alarms.

## Consequences
- Developers must never copy server query results into Zustand.
- All new query keys must be created via key factories (`shiftKeys`, `teamKeys`, `feedKeys`).
- Persister whitelist must be reviewed if any new domain entities require offline access.
