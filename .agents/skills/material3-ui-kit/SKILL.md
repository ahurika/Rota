---
name: material3-ui-kit
description: Use when building or changing any Rota screen or UI component: Material Design 3 theme with React Native Paper, the five-destination navigation bar, top app bars, password field with strength meter, confirmation and success dialogs, snackbars, error messages, and screen states. Contains verified code in app/src/ui and usage patterns. Read docs/DESIGN.md first.
---

# Material 3 UI kit for Rota

Read `docs/DESIGN.md` for the spec. This skill shows how to build it with the code already in `app/src/ui/`.

## Install (once, from `app/`)

```
npx expo install react-native-paper react-native-safe-area-context @expo/vector-icons
```

Always use `npx expo install` so versions match the Expo SDK. Paper 5.x implements Material 3 (baseline). Expo SDK 57 moved Router's tabs: use `import { Tabs } from 'expo-router/js-tabs'`, because the `Tabs` export from `expo-router` is deprecated. Re-check Expo and Paper docs if an import fails, versions move fast.

## What is already written (verified: type-checks, lints, bundles)

| File | Purpose |
|---|---|
| `src/ui/tokens.ts` | Light and dark color roles, spacing, shape, type scale, state layers |
| `src/ui/theme.ts` | Paper themes. Shadows off, tonal surfaces mapped to elevation levels, `extraColors()` for success and warning |
| `src/ui/passwordStrength.ts` | `scorePassword(pw, email)` returns score, label, checks, hint, allowed |
| `src/ui/errorMessages.ts` | `toUxMessage(code, params)` and `fieldMessage(code)` |
| `src/ui/components/AppTabBar.tsx` | Navigation bar for Expo Router tabs, with badges |
| `src/ui/components/ScreenHeader.tsx` | Flat top app bar (small, center-aligned, medium, large) |
| `src/ui/components/PasswordField.tsx` | Outlined field, show or hide, strength meter, checklist |
| `src/ui/components/ConfirmDialog.tsx` | Delete and destructive confirmations, optional type-to-confirm |
| `src/ui/components/ResultDialog.tsx` | Success, error, and info dialogs for milestones |
| `src/ui/components/SnackbarProvider.tsx` | `useSnackbar().show(message, { actionLabel, onAction })` |
| `src/ui/examples/*` | Tabs layout, sign up screen, delete shift flow. Reference only, copy when needed |
| `src/app/_layout.tsx` | Providers: Query, Paper theme (follows phone light or dark), Snackbar |

## Wiring the navigation bar (milestone M4)

Create `src/app/(tabs)/_layout.tsx` from `src/ui/examples/TabsLayout.example.tsx`. It needs five route files in `src/app/(tabs)/`: `index.tsx` (Schedule), `swaps.tsx`, `activity.tsx`, `team.tsx`, `settings.tsx`. The M0 health screen `src/app/index.tsx` conflicts with `(tabs)/index.tsx` (both map to `/`), so move the health check into Settings (or delete it) when you add the tabs.

Pending swap badge: for owners and managers, `badges={{ swaps: pendingCount }}`. Staff pass 0. Read the count from a TanStack Query hook, never from local state.

Tablet: at 600 dp wide or more, use a navigation rail with the same five destinations. Paper has no rail, so build a small `AppNavRail` from `Drawer.Section` or plain `Pressable` rows in a later polish step, and record it in an ADR.

## Screens: standard shell

```tsx
<View style={{ flex: 1, backgroundColor: theme.colors.background }}>
  <ScreenHeader title="Team" actions={[{ icon: 'account-plus-outline', label: 'Invite member', onPress: openInvite }]} />
  {/* content with 16 dp horizontal padding */}
</View>
```

Use `Card mode="outlined"` for grouped content. Never `elevated`. Use `List.Item` for rows. Use `Chip` for roles and statuses (`mode="outlined"` for neutral, a tonal container color for status).

## Forms

```tsx
<TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail}
  keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={Boolean(emailError)} />
{emailError ? <HelperText type="error" visible>{emailError}</HelperText> : null}
<PasswordField value={password} onChangeText={setPassword} email={email} showStrength autoComplete="new-password" />
```

Validate on blur and submit. See `src/ui/examples/SignUpScreen.example.tsx` for the full pattern with a server error banner and a success dialog.

## Password strength: tests to write (server-side rules too)

The app meter and the server rules must agree on the hard limits. Put the same cases in a Vitest test for the app function and a separate test for the server validator.

| Password | Expected score | Allowed |
|---|---|---|
| (empty) | 0 Too short | no |
| `short1` | 0 Too short | no |
| `password123` | 1 Weak (common) | no |
| `aaaaaaaaaaaa` | 1 Weak (repetitive) | no |
| `abababababab` | 1 Weak (repetitive) | no |
| `lowercaseonly` | 1 Weak (one character type) | yes |
| `kate.ahurika99` with email `kate.ahurika@x.com` | 1 Weak (contains email name) | no |
| `Blue7table` | 2 Fair | yes |
| `Blue7tableWalks` | 3 Good | yes |
| `correct horse battery` | 4 Strong | yes |
| `Tr0ub4dor&3xyz!!` | 4 Strong | yes |
| 129 characters | 0 | no |

All twelve cases were run against `scorePassword` and passed. The server must use a much larger common-password list than the sample in the app (check the list's license before bundling it) and must hash with argon2id.

## Delete and destructive actions

Always: button opens `ConfirmDialog`, confirm runs a mutation, success closes and shows a snackbar, failure keeps the dialog open with the reason. Full example: `src/ui/examples/DeleteShift.example.tsx`. Copy for each action: `docs/DESIGN.md` section 6.3.

```tsx
<ConfirmDialog visible={open} destructive title="Remove Ama from the team?"
  message="They lose access to Brew and Bake and their upcoming shifts become unassigned. Their seat becomes free."
  confirmLabel="Remove member" loading={mutation.isPending} errorText={errorText}
  onConfirm={() => mutation.mutate()} onDismiss={() => { mutation.reset(); setOpen(false); }} />
```

## Success

- Snackbar: `snackbar.show('Shift saved')`. Add `bottomOffset: 80` on tab screens so it sits above the navigation bar.
- Dialog: `<ResultDialog kind="success" title="Invite sent" message="Ama will get an email with a link to join." actionLabel="Done" onClose={...} />`.
- Never show both for one event.

## Errors

```tsx
const ux = toUxMessage(error.code, { retryAfterSec, seatLimit, planName });
// banner or snackbar text: `${ux.title}. ${ux.message}`; button: ux.action?.label
```

Add every new server error code to `errorMessages.ts` and to `docs/DESIGN.md` section 6.2. The server must return `{ error: { code, message, requestId, fields? } }`. Update the Zod error handler in `server/src/app.ts` to fill `fields` from validation issues using stable field codes (`EMAIL_INVALID`, `PASSWORD_TOO_SHORT`, and so on).

## Things to check on a real device (the sandbox could not)

- The navigation bar height, indicator pill, and badge look right and match the spec in `docs/DESIGN.md` section 3.2.
- Dialogs show no visible shadow in light and dark. If a shadow appears on an older Android version, set the dialog `style={{ elevation: 0 }}`.
- Text at 200% system font size, TalkBack reading order, and keyboard overlap on the sign up screen.
- Tabs and the Android back button behave as described in section 3.4.

## Explain-back questions for the human

1. Why does the theme map tonal surfaces to elevation levels instead of using shadows?
2. Why is the password meter advisory, and which rules does the server enforce?
3. Why does a failed delete keep the dialog open instead of closing it?
