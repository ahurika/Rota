---
name: mobile-state-offline-optimistic
description: Use when building Rota app screens that fetch or change data: TanStack Query setup, query keys and cache times, Zustand for UI state, persisted offline shifts with a last updated label, optimistic swap requests with rollback, the API client with token refresh, and writing STATE.md.
---

# Mobile state, offline viewing, and optimistic updates

## The three kinds of state

| Kind | Where | Rota examples |
|---|---|---|
| Server state | TanStack Query | shifts, members, feed, billing status, settings |
| Client state | Zustand | selected tab, filters, swap draft note, dismissed banner |
| Persisted state | Query cache persisted to AsyncStorage | upcoming shifts, roster |
| Secrets | expo-secure-store | access token, refresh token |

Why Zustand: tiny, no providers or boilerplate, good for small UI-only state. Write this reasoning into `STATE.md`.

## Install (check current versions with `npx expo install`)

`@tanstack/react-query`, `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `zustand`, `@shopify/flash-list`, `expo-secure-store`.

## QueryClient and persistence

```ts
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 2 } },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'rota-cache-v1' });

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    maxAge: 24 * 60 * 60 * 1000,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) =>
        q.state.status === 'success' && ['shifts', 'roster'].includes(String(q.queryKey[0])),
    },
  }}
>
```

Rules:
- `gcTime` must be at least `maxAge`, or cached data is garbage collected before it can be restored.
- Persist **only** shifts and roster. Never persist billing data or settings. Never persist tokens (they live in SecureStore).
- Bump the persister key (`v1` to `v2`) when the cached data shape changes.
- On logout: `queryClient.clear()` and `persister.removeClient()`.

## Query keys (one factory per feature)

```ts
export const shiftKeys = {
  all: (teamId: string) => ['shifts', teamId] as const,
  range: (teamId: string, from: string, to: string) => ['shifts', teamId, from, to] as const,
  upcoming: (teamId: string) => ['shifts', teamId, 'upcoming'] as const,
};
```

## Cache times (record final values in STATE.md with reasons)

| Data | staleTime | gcTime | Persisted |
|---|---|---|---|
| Upcoming shifts | 60 s | 24 h | yes |
| Roster | 5 min | 24 h | yes |
| Activity feed | 15 s | 10 min | no |
| Settings | 0 (refetch on focus) | 24 h | no |
| Billing status | 0 | 5 min | no |

## Offline UX

```ts
const q = useQuery({ queryKey: shiftKeys.upcoming(teamId), queryFn: ... });
const lastUpdated = q.dataUpdatedAt ? new Date(q.dataUpdatedAt) : null;
// Show: "Last updated 2:14 PM" and an offline banner when NetInfo says offline
```

- Connect `onlineManager` to NetInfo so queries pause offline and resume online.
- Offline: show cached shifts, show the banner, disable write buttons with a short explanation.
- Demo for the video: load shifts, switch on airplane mode, kill and reopen the app, shifts still show with the "last updated" label.

## Optimistic swap request (the required pattern)

```ts
useMutation({
  mutationFn: (v: { shiftId: string }) => api.post(`/teams/${teamId}/swaps`, v),
  onMutate: async ({ shiftId }) => {
    await qc.cancelQueries({ queryKey: shiftKeys.all(teamId) });
    const snapshot = qc.getQueriesData({ queryKey: shiftKeys.all(teamId) });
    qc.setQueriesData({ queryKey: shiftKeys.all(teamId) }, (old: Shift[] | undefined) =>
      old?.map(s => s.id === shiftId ? { ...s, swapStatus: 'pending' } : s));
    return { snapshot };
  },
  onError: (_e, _v, ctx) => {
    ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));   // rollback
    showToast('Swap request failed. Reverted.');
  },
  onSettled: () => qc.invalidateQueries({ queryKey: shiftKeys.all(teamId) }),
});
```

The button is disabled while `isPending` and shows "Swap requested" immediately, so the user cannot double submit. The server also returns the existing request if a duplicate arrives (FR-S6).

## Zustand store example (UI only)

```ts
export const useUi = create<{ tab: 'shifts' | 'feed'; swapNote: string; setTab: (t) => void; setSwapNote: (s: string) => void }>(...);
```

Never put fetched data in the store.

## API client with refresh

- One `request()` wrapper adds `Authorization`, parses the error shape, and on 401 calls refresh **once**.
- Keep a single in-flight refresh promise. Parallel requests that get a 401 await the same promise, so the app never sends the same refresh token twice (that would trip reuse detection).
- On refresh failure: clear SecureStore, clear the query cache, navigate to login.
- Never log tokens or full responses.

## Feed screen checklist

FlashList, `useInfiniteQuery` (see `cursor-pagination-feed`), loading skeleton, empty state, error with retry, end-of-list footer, pull to refresh, guarded `onEndReached`.

## STATE.md template

```
| Data | Kind | Lives in | Why | Cache time | Persisted | Cleared on logout |
|---|---|---|---|---|---|---|
| Access token | secret | SecureStore | encrypted storage | n/a | yes (secure) | yes |
| Upcoming shifts | server | TanStack Query | server owns it, offline need | 60 s stale | yes | yes |
| Selected tab | client | Zustand | UI only | n/a | no | n/a |
...
```

List every important piece of data. Include theme and language (fetched from settings, applied in a provider).

## Tests

- API client: two parallel 401s trigger exactly one refresh call.
- Optimistic swap: on server error, the cache returns to the snapshot.
- Persist: after restore, upcoming shifts exist without network.
- Notification route allow list rejects unknown URLs.

## Explain-back questions for the human

1. Why must the swap button disable while pending, even though the server dedupes?
2. What data should never be persisted offline, and why?
3. Why does one shared refresh promise matter?
