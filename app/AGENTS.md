# AGENTS.md: app

Applies to everything under `app/`. Root `AGENTS.md` and `PRD.md` still apply.

## Layout

```
app/
  app/                      Expo Router routes (screens)
    (auth)/                 login, register, magic link, reset
    (tabs)/                 shifts, feed, team, billing (owner), settings
    invite/[token].tsx      deep link target for invites
  src/
    api/                    typed fetch client, error mapping, token refresh
    features/               shifts/, swaps/, feed/, billing/, settings/, auth/
    state/                  zustand stores (UI state only)
    query/                  QueryClient, persister, query keys
    notifications/          registration, tap handling, deep link routing
    ui/                     tokens.ts, theme.ts, components/, and utilities
    lib/                    secure storage, date helpers, constants
```

## Rules

1. Server data goes through TanStack Query. Zustand holds UI-only state (selected tab, draft form, filters).
2. Tokens live only in `expo-secure-store`. Never AsyncStorage.
3. The app never decides a payment result. After checkout it polls the server billing status.
4. Every list has loading, empty, error, and end states. A blank screen is a bug.
5. Every touchable has an `accessibilityLabel` and a touch target of at least 44 by 44 points (48dp for Material 3 touch targets).
6. Colours, spacing, and type sizes come from `src/ui/tokens.ts` and the theme in `src/ui/theme.ts`. No random numbers in styles.
7. The only `EXPO_PUBLIC_` variables allowed are listed in `PRD.md` Appendix A.
8. Optimistic updates always have an `onError` rollback and an `onSettled` refetch.
9. Notification taps must validate the route against an allow list before navigating.
10. UI and UX adhere to Material Design 3 (see `docs/DESIGN.md` and `.agents/rules/07-ui-ux-material3.md`). Use React Native Paper components. No drop shadows, no gradients. Destructive actions always use `ConfirmDialog`.
