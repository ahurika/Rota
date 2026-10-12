# Mobile State Architecture & Offline Cache (`docs/STATE.md`)

This document defines the state management boundaries, caching policies, offline persistence, and token handling for the Rota mobile application, enforcing **Rule 04**.

---

## 1. State Classification & Storage Boundaries

State in Rota is strictly segregated by lifecycle, permanence, and security characteristics. Never copy server data into client stores.

| Kind | Storage Tool | Examples | Storage Location | Invalidation / Cleanup |
|---|---|---|---|---|
| **Server State** | TanStack Query (`@tanstack/react-query`) | Shifts, Roster, Activity feed, Billing status, Settings | In-memory Query Cache | Stale-time expiry, pull-to-refresh, query invalidation |
| **Client-Only State** | Zustand (`zustand`) | Active tab, draft swap notes, offline banner dismissal, active filters | In-memory JS Heap | Reset on logout or component unmount |
| **Persisted Offline State** | Query Persister (`@tanstack/query-async-storage-persister`) | Upcoming shifts, team roster | SQLite / AsyncStorage | 24-hour GC time; cleared completely on logout |
| **Secrets & Credentials** | `expo-secure-store` | JWT access token, rotating refresh token | Android Keystore / Encrypted SharedPreferences | Overwritten on token rotation; purged on logout / 401 failure |

### Core Rules
1. **Zero Copying**: Server state is never copied into Zustand. Components read directly from `useQuery` or `useInfiniteQuery`.
2. **Key Factories**: All query keys are derived from domain factories (`shiftKeys`, `feedKeys`, `teamKeys`). Raw string literals are forbidden in hooks.
3. **Strict Secrets Segregation**: Tokens and credentials MUST NEVER be stored in AsyncStorage or MMKV. Only hardware-backed `expo-secure-store` is permitted.

---

## 2. Cache Policies & Lifecycles

| Data Domain | `staleTime` | `gcTime` | Persisted Offline? | Rationale |
|---|---|---|---|---|
| **Upcoming Shifts** | 60 seconds | 24 hours | **Yes** (`shifts`) | Critical for shift workers. Shifts change moderately, but must remain visible during subway / basement offline periods ("Airplane Mode demo"). |
| **Team Roster** | 5 minutes | 24 hours | **Yes** (`roster`) | Team membership changes infrequently; allows shift coworker names to resolve offline. |
| **Activity Feed** | 15 seconds | 10 minutes | **No** | Dynamic event stream. Fresh feel; pull-to-refresh resets cursor chain. Stored only in memory. |
| **User Settings** | 0 seconds (refetch on focus) | 24 hours | **No** | Settings must stay synchronized across multi-device sessions immediately. |
| **Billing Status** | 0 seconds | 5 minutes | **NEVER** | Financial and subscription state must always be authoritatively confirmed by the backend. |

---

## 3. Offline Cache Persistence (`shouldDehydrateQuery`)

TanStack Query persister is configured with a strict dehydration whitelist to prevent stale secrets or stale billing data from leaking into unencrypted storage:

```typescript
export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // 1. Only persist queries that succeeded
      if (query.state.status !== 'success') return false;

      // 2. Strict Whitelist: Only persist 'shifts' and 'roster'
      const key = query.queryKey[0];
      return key === 'shifts' || key === 'roster';
    },
  },
};
```

### Offline UI Indications
- When `NetInfo.isConnected === false`, a sticky warning banner appears: *"You are offline. Showing cached shifts. Actions are disabled."*
- Cached data displays a timestamp indicator: *"Last updated [HH:MM]"* derived from `query.dataUpdatedAt`.
- Mutating actions (e.g. requesting a shift swap) are disabled with informative alerts to prevent uncoordinated local state divergence.

---

## 4. Optimistic Updates & Rollback Lifecycle

For actions requiring instant user feedback (e.g. requesting a swap), Rota employs the TanStack Query optimistic mutation pattern:

```
[User taps "Request Swap"]
          │
          ▼
   1. onMutate
      ├── Cancel in-flight queries for shiftKeys.all(teamId)
      ├── Snapshot previous cache data via qc.getQueriesData()
      ├── Optimistically set swapStatus: 'pending' in cache
      └── Return snapshot context
          │
    ┌─────┴────────────────────────┐
    ▼                              ▼
[Network OK: 200]             [Network Error: 4xx/5xx]
    │                              │
    │                              ▼
    │                         2. onError
    │                            ├── Restore snapshot to cache
    │                            └── Present error alert to user
    │                              │
    └──────────────┬───────────────┘
                   ▼
             3. onSettled
                └── Invalidate shiftKeys.all(teamId) to re-sync authoritative server state
```

---

## 5. Token Rotation & In-Flight 401 Coalescing

In high-concurrency environments, multiple queries may trigger simultaneous `401 Unauthorized` responses when an access token expires.
If each 401 separately calls `POST /v1/auth/refresh`, the second call uses a refresh token that was already rotated, triggering the server's **Reuse Detection Security Alarm (Proof Test T4)** and locking the user out.

To solve this, `ApiClient` coalesces concurrent refreshes behind a single in-flight promise:

```typescript
private refreshPromise: Promise<string> | null = null;

public async refreshAccessToken(): Promise<string> {
  if (this.refreshPromise) {
    // Coalesce: Return existing in-flight refresh promise
    return this.refreshPromise;
  }

  this.refreshPromise = (async () => {
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      const res = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await secureStorage.clearTokens();
        this.triggerAuthFailure();
        throw new ApiError(res.status, { code: 'UNAUTHORIZED', message: 'Session expired' });
      }

      const data = await res.json();
      await secureStorage.setAccessToken(data.accessToken);
      await secureStorage.setRefreshToken(data.refreshToken);
      return data.accessToken;
    } finally {
      this.refreshPromise = null; // Reset lock
    }
  })();

  return this.refreshPromise;
}
```

---

## 6. Notification Deep-Link Route Validation

Deep links arriving via push notification data payloads (`data.url`) are strictly validated against an allow-list before navigation:

Allowed routes:
- `/shifts/:id`
- `/swaps/:id`
- `/billing`
- `/feed`
- `/settings`

Any unmatched URLs, external protocols (`http://`, `javascript:`), or disallowed paths return `null` and are discarded to eliminate open-redirect vulnerabilities.
