# Rule 04: Mobile app standards

**Activation:** Glob `app/**`.

## Platform

1. React Native with Expo and Expo Router, TypeScript strict mode.
2. Push notifications need a development build made with EAS Build. Expo Go is not enough on recent Expo versions. See skill `eas-build-and-deep-links`.
3. Target Android. iOS builds are out of scope.

## Where each kind of state lives

| Kind | Tool | Examples |
|---|---|---|
| Server state | TanStack Query | shifts, members, feed, billing status, settings |
| Client-only state | Zustand | selected tab, draft swap note, filters, banner dismissed |
| Persisted state | Query persister (AsyncStorage) | upcoming shifts for offline |
| Secrets | `expo-secure-store` | access token, refresh token |

Rules:

1. Never copy server data into Zustand. Read it from the query cache.
2. Keep `docs/STATE.md` current. Every important piece of data appears there with where it lives and why.
3. Query keys are built by one factory per feature (for example `shiftKeys.list(teamId, from, to)`).

## Cache times (record the final values in `STATE.md`)

| Data | staleTime | gcTime | Reason |
|---|---|---|---|
| Upcoming shifts | 60 s | 24 h | Changes often, must exist offline |
| Team roster | 5 min | 24 h | Changes rarely |
| Activity feed | 15 s | 10 min | Fresh feel, pull to refresh available |
| Settings | 0 s (refetch on focus) | 24 h | Must sync across devices |
| Billing status | 0 s, never persisted | 5 min | Money state must be fresh |

## Optimistic updates (swaps and settings)

Pattern in `onMutate`: cancel queries for the key, snapshot the previous data, write the optimistic data, return the snapshot. In `onError`: restore the snapshot and show an error toast. In `onSettled`: invalidate the key. Disable the button while pending so the user cannot double submit.

## Tokens and API client

1. A single API client adds the access token, retries once on 401 after calling refresh, and queues concurrent requests behind one refresh call.
2. On refresh failure, clear tokens, clear the query cache, and send the user to login.
3. Never log tokens.

## Lists

1. Use FlashList for the activity feed with `estimatedItemSize`, `onEndReached` with a threshold, and `onEndReachedThreshold` around 0.5.
2. Prevent duplicate page requests: use `useInfiniteQuery`, check `isFetchingNextPage` and `hasNextPage` before calling `fetchNextPage`.
3. Show states: first-load skeleton, empty state, error state with retry, end-of-list footer, pull to refresh.
4. Use stable `keyExtractor` based on the event id.

## Offline

1. Persist the query cache with the async-storage persister. Only persist shifts and roster (set `shouldDehydrateQuery` to include only those keys).
2. Show "Last updated" using `dataUpdatedAt` from the query.
3. Show an offline banner using NetInfo. Disable write actions that cannot work offline and say why.
4. Clear the persisted cache on logout.

## Notifications

1. Register the device push token after login. Remove it on logout.
2. On tap, read `data.url` from the notification, check it against an allow list (`/shifts/:id`, `/swaps/:id`, `/billing`), then navigate. Ignore anything else.
3. Handle cold start taps (`getLastNotificationResponseAsync`) and warm taps (listener).

## Billing screens

1. The app opens the provider's hosted checkout in the browser. It never sees card data or secret keys.
2. After return, show "Confirming payment" and poll `GET /billing` every 2 seconds up to 60 seconds. The server's answer decides what the user sees.
3. Show the proration preview from `POST /billing/preview`. Never compute prices in the app.

## UI quality (Rota does not need Matinee-level polish, but must be clean)

1. Tokens file `src/ui/tokens.ts`: colours, spacing scale (multiples of 4), type scale, radii. No random numbers.
2. Text contrast at least 4.5 to 1. Touch targets at least 44 by 44 points. Every touchable has `accessibilityLabel` and `accessibilityRole`.
3. Text scales with system font size (do not disable `allowFontScaling`).
4. Support light and dark theme driven by the saved setting.
5. Handle small and large phones without clipped content.

## Env and secrets

Only the three `EXPO_PUBLIC_` variables in `PRD.md` Appendix A are allowed. Before each build, list every `EXPO_PUBLIC_` variable in the README and explain why it is safe.

## Do not

- Do not store tokens in AsyncStorage or MMKV.
- Do not call the payment provider SDK with a secret key.
- Do not compute proration, seat limits, or permissions as the source of truth in the app.
- Do not use `useEffect` for server fetching. Use TanStack Query.
