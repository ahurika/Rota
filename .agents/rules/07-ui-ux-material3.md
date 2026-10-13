# Rule 07: UI and UX (Material Design 3)

**Activation:** Glob `app/**`. Also set to Model Decision so it loads for any UI, copy, or navigation question.

Read `docs/DESIGN.md` before building or changing any screen. It is the source of truth for navigation, screens, copy, and tokens. If a screen is not specified, design it from the rules below and add it to `docs/DESIGN.md`.

## Design system

1. Material Design 3 (baseline) through `react-native-paper` 5.x. Use Paper components first: `Appbar`, `BottomNavigation.Bar`, `Dialog`, `Snackbar`, `TextInput`, `Button`, `Chip`, `Card`, `List`, `Switch`, `FAB`, `ProgressBar`, `Badge`, `SegmentedButtons`.
2. Colors, spacing, shape, and type come from `app/src/ui/tokens.ts` and the theme in `app/src/ui/theme.ts`. Never write a raw hex value, never use a spacing number outside the scale (4, 8, 12, 16, 24, 32, 48), never invent a font size.
3. Use theme roles (`theme.colors.primary`, `onSurface`, `surfaceContainer`). Success and warning come from `extraColors(theme.dark)`.
4. Support light and dark theme. Test both.
5. Before using an Expo, Paper, or Material API you are not sure about, read the current docs. Do not guess.

## Hard visual rules

1. **No shadows.** Do not set `elevation`, `shadow*`, or `elevated` on anything. Use tonal surfaces and 1 dp `outlineVariant` borders. Cards use `mode="outlined"` or `mode="contained"`, never `elevated`.
2. **No gradients.** No `LinearGradient`, no gradient images, no gradient backgrounds.
3. No glassmorphism, blur, neon, decorative blobs, emoji as icons, or stock illustrations.
4. One icon family (Material Symbols via Paper). Outlined when inactive, filled when selected.
5. One primary action per screen (one filled button or one FAB). Secondary actions are tonal, outlined, or text buttons.
6. Left-align text. Center only inside dialogs and empty states.
7. Use real content in examples and tests (names, times, amounts). No lorem ipsum.

## Navigation

1. Five bottom destinations, in this order: Schedule, Swaps, Activity, Team, Settings. Same for every role. Content and actions differ by role (see `docs/DESIGN.md` section 3.8).
2. Use `AppTabBar` with `Tabs` from `expo-router/js-tabs`. Do not use the deprecated `Tabs` export from `expo-router`. Do not build a second bottom bar.
3. Show the bar only on the five root screens. Hide it on detail, editor, auth, and checkout screens.
4. Use `ScreenHeader` for every top app bar. Maximum three trailing actions, each with an `accessibilityLabel`. Settings uses the large app bar, others use small.
5. One FAB at most per screen. Only "Add shift" on Schedule, only for owners and managers.
6. Role checks that hide UI are for convenience only. The server enforces everything.

## Forms

1. Outlined `TextInput` with a label. Supporting text for help and errors.
2. Validate on blur and on submit, not on every keystroke. Clear a field's error when the user edits it.
3. Never disable the submit button just because the form is invalid. Disable it only while a request is running, with a progress indicator in the button.
4. Set `keyboardType`, `autoComplete`, and `textContentType`. Allow paste. Keep user input after a failed submit.
5. Password fields use `PasswordField`. Sign up and reset pass `showStrength`. Login does not. The meter is advisory: the server enforces min 10, max 128, and a common password check. Do not require symbols, uppercase, or digits.

## Errors

1. Never show a raw server `message`, a status code, or an error code to the user. Map `error.code` through `toUxMessage` in `app/src/ui/errorMessages.ts`. Map field codes through `fieldMessage`.
2. Message formula: what happened, then what to do next. Specific, no blame, no jargon, no exclamation marks.
3. Placement: field error under the field, form error in a banner above the form, background failure in a snackbar with Retry, whole-screen failure as an error state with "Try again", decision in a dialog.
4. Login and reset errors stay generic (no account enumeration).
5. When you add a server error code, add its copy to `errorMessages.ts` and to the table in `docs/DESIGN.md` in the same change.

## Dialogs and confirmations

1. **Every destructive action uses `ConfirmDialog`.** Never delete, remove, cancel, or log out everywhere on the first tap. Destructive actions: delete shift, remove member, cancel or reject a swap, log out of all devices, schedule a downgrade, remove seats.
2. Title is a question naming the thing ("Delete this shift?"). Body states the consequence and that it cannot be undone. Cancel on the left. The confirm button uses the specific verb ("Delete shift") in `error` color for destructive actions.
3. While the request runs, disable both buttons and ignore outside taps. If it fails, keep the dialog open and show the reason under the message. After success, close the dialog and show a snackbar ("Shift deleted").
4. Irreversible, high-impact actions use type-to-confirm (`requireText`).
5. Success feedback: Level 1 is a snackbar (shift saved, shift deleted, settings saved). Level 2 is `ResultDialog` for milestones (account created, team created, invite sent, plan changed, payment confirmed). Never show both for one event.
6. Dialog buttons are text buttons with verbs. Never "OK" or "Yes".

## States

Every list and data screen has: loading (skeleton, no spinner-only screens), empty (icon, title, sentence, action), error (message plus "Try again"), offline (banner with last updated time), and restricted (past due banner). A blank screen is a bug.

## Accessibility

1. Text contrast 4.5 to 1, borders and icons 3 to 1. Use the theme pairs, which are verified.
2. Touch targets at least 48 by 48 dp. Never set `allowFontScaling={false}`. Test at 200% text size.
3. Every icon button, switch, and image has an `accessibilityLabel`. Badges announce the count.
4. Do not use color alone to carry meaning. Pair it with text or an icon.
5. Announce errors and strength changes with `accessibilityLiveRegion`.

## Copy

Sentence case. Short, active voice. Buttons are verbs ("Add shift", "Send invite"). Dates like "Fri 14 Oct, 09:00 to 17:00" in the user's time zone. Amounts from cents ("$20.00"). Use "shift", "swap request", "seat", "team" consistently.

## Review checklist (run before every UI commit)

- [ ] No raw hex, no off-grid spacing, no shadow or gradient props
- [ ] Paper components and theme roles used
- [ ] All states designed (loading, empty, error, offline, restricted)
- [ ] Destructive actions use `ConfirmDialog`
- [ ] Errors come from the message library, input kept
- [ ] Labels, 48 dp targets, text scales, light and dark both checked
- [ ] `npx tsc --noEmit` and `npx expo lint` clean
