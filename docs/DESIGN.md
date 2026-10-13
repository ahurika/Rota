# Rota Design Spec (UX and UI)

| Field | Value |
|---|---|
| Design system | Material Design 3 (baseline), implemented with React Native Paper (MD3) |
| Brand seed color | `#0E6F73` (teal) |
| Platform | Android first (phones 360 to 412 dp wide), tablets supported |
| Companion docs | `PRD.md` (requirements), `.agents/rules/07-ui-ux-material3.md` (agent rules) |

---

## 1. Design principles

1. **Clarity over decoration.** Every element earns its place. If it does not help someone read, decide, or act, remove it.
2. **One primary action per screen.** One filled button or one FAB. Everything else is tonal, outlined, or a text button.
3. **Show what the role can do.** Staff never see buttons they cannot use. The server still enforces every rule.
4. **Make mistakes recoverable.** Confirm destructive actions. Keep dialogs open on failure and say why.
5. **Be honest about state.** Every screen has designed loading, empty, error, offline, and restricted states.
6. **Use known patterns.** Material 3 components in their documented places. People already know how they behave.
7. **Accessible by default.** Contrast, 48 dp targets, labels, text scaling, and no meaning carried by color alone.

## 2. Visual language

### 2.1 Rules (hard)

- **No drop shadows.** Depth comes from tone (surface container colors) and 1 dp outlines (`outlineVariant`). The theme sets the shadow color to transparent.
- **No gradients.** Solid colors only. No gradient buttons, headers, backgrounds, or illustrations.
- **No glass, blur, or neon.** No decorative blobs or abstract shapes.
- **Color is a signal.** Primary color marks the main action and the selected state. Do not paint large areas with it.
- **Left-aligned text.** Center text only in dialogs with an icon and in empty states.
- **Real content in every design.** Real names, times, and amounts. No lorem ipsum, no "John Doe".

### 2.2 Checklist: does this look generated?

Reject the screen if any answer is yes.

- Purple to blue gradient anywhere?
- Floating cards with large soft shadows?
- Emoji used as icons?
- Everything centered, with a big rounded hero card?
- Vague headings such as "Welcome back!" or "Let's get started!"?
- Stock-style 3D or blob illustrations?
- More than one accent color on a single screen?
- Spacing that is not a multiple of 4 dp?
- Icons from more than one family or style?

### 2.3 Color (Material 3 roles, generated from the seed)

Generated with Google's `@material/material-color-utilities` (TonalSpot scheme). Success and warning are custom roles, harmonized toward the seed. Full list in `app/src/ui/tokens.ts`. Do not edit hex values by hand.

| Role | Light | Dark | Use |
|---|---|---|---|
| primary | `#00696D` | `#80D4D8` | Main button, selected state, links |
| onPrimary | `#FFFFFF` | `#003739` | Text on primary |
| primaryContainer | `#9CF1F5` | `#004F52` | Tonal emphasis |
| secondaryContainer | `#CCE8E9` | `#324B4C` | Navigation indicator, selected chips |
| surface / background | `#F4FBFA` | `#0E1415` | Screen background |
| surfaceContainerLow | `#EFF5F5` | `#161D1D` | Cards, list groups |
| surfaceContainer | `#E9EFEF` | `#1A2121` | Navigation bar, sheets |
| surfaceContainerHigh | `#E3E9E9` | `#252B2B` | Dialogs, menus |
| onSurface | `#161D1D` | `#DDE4E3` | Primary text |
| onSurfaceVariant | `#3F4949` | `#BEC8C9` | Secondary text, icons |
| outline | `#6F7979` | `#899393` | Field borders (never for text) |
| outlineVariant | `#BEC8C9` | `#3F4949` | Dividers, card borders |
| error / errorContainer | `#BA1A1A` / `#FFDAD6` | `#FFB4AB` / `#93000A` | Errors, destructive actions |
| success / successContainer | `#006D43` / `#92F7BC` | `#76DAA1` / `#005231` | Success, strong password |
| warning / warningContainer | `#7D5700` / `#FFDEAA` | `#F7BD51` / `#5F4100` | Pending, past due, fair password |

**Contrast (computed from the values above, WCAG ratio):**

| Pair | Light | Dark |
|---|---|---|
| onPrimary on primary | 6.48 | 7.68 |
| onPrimaryContainer on primaryContainer | 7.28 | 7.28 |
| onErrorContainer on errorContainer | 7.24 | 7.24 |
| onSurface on surface | 16.31 | 14.41 |
| onSurfaceVariant on surfaceContainerHighest | 7.20 | 7.20 |
| primary on surface | 6.18 | 10.91 |
| error on surface | 6.16 | 10.95 |
| outline on surface (borders only, needs 3:1) | 4.27 | 5.89 |

Every text pair clears 4.5 to 1. Use `outline` for borders and icons only, never for text.

### 2.4 Typography (Material 3 type scale)

| Style | Size / line | Use in Rota |
|---|---|---|
| headlineSmall | 24 / 32 | Large app bar title, plan price |
| titleLarge | 22 / 28 | Dialog title, screen title |
| titleMedium | 16 / 24, medium | List item title, section heading |
| bodyLarge | 16 / 24 | Main body text, text fields |
| bodyMedium | 14 / 20 | Secondary text, dialog body |
| labelLarge | 14 / 20, medium | Buttons |
| labelMedium | 12 / 16, medium | Navigation labels, chips, helper text |

Use the system font. Do not add a decorative typeface. Use sentence case everywhere ("Add shift", not "Add Shift"). Never set `allowFontScaling={false}`.

### 2.5 Shape, spacing, motion

- **Shape (corner radius):** 4 (small elements), 8 (chips), 12 (cards, banners), 16 (large containers), 28 (dialogs), full (buttons, FAB uses 16, badges).
- **Spacing:** 4 dp grid. Tokens: 4, 8, 12, 16, 24, 32, 48. Screen side padding 16 dp. Space between list sections 24 dp.
- **Touch targets:** at least 48 by 48 dp.
- **Motion:** Material standard easing, 200 to 300 ms. Use motion only to explain change (a dialog appearing, a tab changing). No decorative animation. Respect the system "reduce motion" setting.
- **State layers:** hover 8%, focus 10%, pressed 10%, dragged 16% of the content color over the container.

### 2.6 Icons

One family: Material Symbols (through `MaterialCommunityIcons` in Paper). Outlined when inactive, filled when selected. 24 dp. Icons that carry meaning always have a text label or an accessibility label.

---

## 3. Navigation: the menu bar

### 3.1 Pattern

Rota uses a Material 3 **navigation bar** at the bottom of the screen on phones, with five destinations. Material 3 allows three to five. On screens 600 dp wide or more (tablets, landscape), switch to a **navigation rail** with the same destinations.

### 3.2 Specs (Material 3 baseline)

| Property | Value |
|---|---|
| Destinations | 5, same for every role |
| Container height | 80 dp (plus system inset) |
| Container color | `surfaceContainer` |
| Active indicator | 64 by 32 dp pill, `secondaryContainer` |
| Icon | 24 dp. Selected: filled, `onSecondaryContainer`. Unselected: outlined, `onSurfaceVariant` |
| Label | `labelMedium` (12 sp), always visible. Selected: `onSurface`. Unselected: `onSurfaceVariant` |
| Badge | Number badge, `error` fill, on the icon's top right |
| Shadow | None. Optional 1 dp top divider in `outlineVariant` |

Material 3 Expressive (a newer variant) has a flexible 64 dp bar. Paper implements the baseline 80 dp bar, so this spec uses the baseline.

### 3.3 Destinations

| # | Label | Icon (off / on) | Screen | Badge |
|---|---|---|---|---|
| 1 | Schedule | `calendar-month-outline` / `calendar-month` | Shift calendar | none |
| 2 | Swaps | `swap-horizontal` / `swap-horizontal-bold` | Swap requests | Pending approvals (owner and manager only) |
| 3 | Activity | `bell-outline` / `bell` | Activity feed | none (the feed is not an inbox) |
| 4 | Team | `account-group-outline` / `account-group` | Roster and invites | none |
| 5 | Settings | `cog-outline` / `cog` | Settings, plan and billing | Small dot when billing needs attention (owner only) |

Labels are one word, so they never wrap.

### 3.4 Behavior

- **Start tab:** Schedule.
- **Tab memory:** each tab keeps its own screen stack. Tapping the active tab scrolls to the top, and a second tap returns to the tab's root.
- **Android back button:** inside a detail screen, goes back. On a tab's root, goes to Schedule. On Schedule, exits the app.
- **Visibility:** the bar shows only on the five root screens. Detail screens, editors, auth screens, and checkout hide it.
- **Deep links:** a notification opens the tab, then pushes the detail screen. Back returns to that tab.
- **Restricted mode (past due):** the bar stays. A banner on Schedule explains the view-only state.

### 3.5 Top app bars

Use Material 3 top app bars. They are flat (no shadow). They take the background color and change to `surfaceContainer` when content scrolls under them.

| Screen | Type | Title | Leading | Trailing actions |
|---|---|---|---|---|
| Schedule | Small | Month and year, for example "October 2026" | none | Go to today (`calendar-today`), Filter (`filter-variant`) |
| Shift detail | Small | "Shift details" | Back | Edit (owner, manager), Delete (owner, manager) |
| Shift editor | Small | "Add shift" or "Edit shift" | Close (`close`) | "Save" text button |
| Swaps | Small, with 2 tabs under it | "Swaps" | none | none |
| Swap detail | Small | "Swap request" | Back | none |
| Activity | Small | "Activity" | none | none |
| Team | Small | "Team" | none | Invite (`account-plus-outline`, owner and manager) |
| Settings | Large (collapses on scroll) | "Settings" | none | none |
| Plan and billing | Small | "Plan and billing" | Back | none |
| Auth screens | Small, no actions | "Log in", "Create account" | Back where needed | none |

Rules: maximum three trailing actions. Every icon action has an accessibility label. Screen titles use sentence case.

### 3.6 Floating action button

One FAB per screen at most, bottom right, 16 dp from the edges, above the navigation bar. Flat style: `primaryContainer` fill, no shadow.

| Screen | FAB | Who sees it |
|---|---|---|
| Schedule | "Add shift" (extended, `plus`) | Owner, manager |
| Team | none (invite lives in the app bar) | n/a |
| Others | none | n/a |

### 3.7 Information architecture

```
Auth: Log in, Create account, Magic link, Reset password, Accept invite
App (navigation bar)
  Schedule   > Day or week view > Shift detail > Request swap (bottom sheet)
                                > Shift editor (owner, manager)
  Swaps      > Pending | History tabs > Swap detail > Approve or reject (owner, manager)
  Activity   > Feed (infinite scroll)
  Team       > Roster > Member detail (role, remove) ; Invite (bottom sheet)
  Settings   > Profile
             > Notifications (types) ; Quiet hours and time zone
             > Appearance (theme) ; Language
             > Plan and billing (owner) > Change plan or seats > Checkout result
             > Devices and sessions > Log out of all devices
             > Log out
```

### 3.8 What differs by role

| Area | Owner | Manager | Staff |
|---|---|---|---|
| Schedule | Everyone's shifts, add and edit | Everyone's shifts, add and edit | Filter "Mine" (default) or "Everyone", read only |
| Swaps | All requests, approve and reject, badge | Same as owner | Own requests only, request and cancel |
| Activity | All | All | All |
| Team | Roster, invite, change roles, remove | Roster, invite staff, remove staff | Roster only |
| Settings | Includes "Plan and billing" | No billing | No billing |

---

## 4. Screen notes

### 4.1 Log in and create account

- Fields: email, password. Outlined text fields. One filled button ("Log in" or "Create account"). Text buttons for "Forgot password?" and "Log in with an email link".
- Login shows no password strength. Sign up and reset show the strength meter (section 5.2).
- Server errors appear in one banner above the form (section 6.1). Field errors appear under the field.
- Accept invite: after login, a short confirmation: "Join Brew and Bake as staff?" with "Join team" and "Not now".

### 4.2 Schedule

- Week strip under the app bar (7 days, selected day filled with `primary`). Below it a list of shifts for the selected day.
- Shift row: time range (`titleMedium`), role label and location (`bodyMedium`), assignee avatar with initials. Status chip when needed: "Swap pending" (warning container), "Unassigned" (outlined).
- Cards use the **outlined** style. No elevation.
- Empty day: "No shifts on Tuesday 14 October." Owners and managers also see "Add shift".
- Offline: banner "You are offline. Showing shifts saved at 2:14 PM." The "last updated" time is always visible.

### 4.3 Swaps

- Two Material 3 tabs: Pending and History.
- Row: requester, shift time, status. Manager row ends with a chevron. Detail screen has "Approve" (filled) and "Reject" (outlined).
- Staff request a swap from Shift detail through a bottom sheet with an optional colleague picker and a note. The button changes to "Swap requested" immediately (optimistic update).

### 4.4 Activity

- Single list, newest first. Row: leading icon in a `secondaryContainer` circle, one sentence ("Ama requested a swap for Fri 9:00"), relative time at the end.
- Pull to refresh, infinite scroll, a footer: loading, "You are all caught up".

### 4.5 Team

- Seat summary at the top: "4 of 5 seats used" with a linear progress bar. Owner also sees "Add seats".
- Member row: name, email, role chip. Overflow menu: "Change role" (owner), "Remove from team" (confirmation dialog).
- Invite bottom sheet: email, role, "Send invite". Copy link option. When seats are full the sheet shows the seat limit message (section 6.2) instead of an error code.

### 4.6 Settings

- Grouped list with section headers. Switch rows for notification types. Time pickers for quiet hours. Time zone as a searchable list.
- Changes save immediately and show a short snackbar only if saving fails (the optimistic update rolls back with the reason).
- "Log out of all devices" opens a confirmation dialog.

### 4.7 Plan and billing (owner)

- Current plan summary card (outlined): plan name, seats, price per month, next renewal date.
- Plan options: three outlined cards in a vertical list, selected one with a 2 dp `primary` border. No gradients, no "Most popular" ribbons.
- Before paying, show the proration preview from the server: "Charge today: $20.00. Next renewal: $50.00 on 1 November."
- After checkout returns, show "Confirming payment" until the server confirms, then a success dialog. Past due: a `warningContainer` banner with "Fix payment".

---

## 5. Forms

### 5.1 Text fields

- Material 3 **outlined** text fields with a floating label. 56 dp high. Supporting text below for help or errors.
- Validate **on blur and on submit**, not on every keystroke. Clear a field's error as soon as the user edits it.
- Error state: border and label in `error`, an error icon at the end, and the message under the field in `error`.
- Never disable the submit button silently. Disable it only while a request runs (and show a progress indicator in the button). Show errors on tap instead.
- Use correct keyboard types, `autoComplete`, and `textContentType` so password managers work. Allow paste.
- Keep the focused field visible above the keyboard. The primary button stays reachable.

### 5.2 Password strength (sign up and reset)

The meter guides the user. **The server enforces the real rules**: at least 10 characters, at most 128, not on the common password list. Do not demand uppercase, symbols, or numbers. Length helps more than composition.

**Anatomy (below the field, appears after the first character):**

1. A segmented bar: four 4 dp tall segments with 4 dp gaps.
2. A text line: `{Label}. {Hint}` in `labelMedium`.
3. A checklist of four lines with a check or empty-circle icon.
4. The whole block is a polite live region so screen readers hear changes.

| Score | Label | Segments filled | Color | When |
|---|---|---|---|---|
| 0 | Too short | 0 | outlineVariant | Under 10 characters |
| 1 | Weak | 1 | error | Common, repetitive, contains the email name, or only one character type |
| 2 | Fair | 2 | warning | 10 or more characters with 2 or more character types |
| 3 | Good | 3 | primary | 12 or more with 3 or more types, or 16 or more characters |
| 4 | Strong | 4 | success | 16 or more with 3 or more types, or 20 or more characters |

**Checklist items:** "At least 10 characters" (required), "Not a common or easy to guess password" (required), "Mix of letters, numbers, or symbols" (suggested), "14 or more characters is stronger" (suggested).

**Hints (examples):** "6 more characters needed." / "This is easy to guess. Try a longer phrase that only you would know." / "Longer is stronger. A short phrase of unrelated words works well."

**Rules:** color never carries the meaning alone (the label and checklist say it too). A password that meets the required checks can be submitted even if it is only "Fair". Show/hide toggle at the end of the field with an accessibility label. The login screen has no meter.

---

## 6. Feedback: errors, success, and confirmations

### 6.1 Choose the right component

| Situation | Component | Example |
|---|---|---|
| One field is wrong | Inline supporting text under the field | "Enter a valid email address, like name@example.com." |
| The form failed on the server | Error banner above the form (`errorContainer`) | "Email or password is incorrect. Check both and try again." |
| A background action failed | Snackbar with a "Retry" action | "Could not save. Reverted." |
| The whole screen cannot load | Full-screen error state with "Try again" | "No connection" |
| Action needs a decision | Dialog | Delete confirmation |
| Important action completed | Result dialog (success) | "Invite sent" |
| Small action completed | Snackbar | "Shift saved" |

### 6.2 How to write an error message

1. Say **what happened**, then **what to do next**. Two short sentences.
2. Be specific. "Your Starter plan allows 5 people" beats "Limit reached".
3. No blame ("You entered..."), no codes, no jargon, no exclamation marks, no humor.
4. Offer the fix as a button where one exists ("Reset password", "See plans", "Try again").
5. Security exception: login and reset messages stay generic (never confirm whether an email exists).
6. Keep the user's input. Never clear a form because it failed.
7. Show the request id in a "Details" line only for server errors, so support can find the log.

**Message library (implemented in `app/src/ui/errorMessages.ts`):**

| Code | Title | Message | Action |
|---|---|---|---|
| NETWORK_ERROR | No connection | Check your internet connection and try again. | Try again |
| INVALID_CREDENTIALS | Email or password is incorrect | Check both and try again, or reset your password. | Reset password |
| RATE_LIMITED | Too many attempts | Wait 5 minutes and try again. | none |
| FORBIDDEN | You cannot do this | Your role does not allow this action. Ask an owner or manager for help. | Got it |
| NOT_FOUND | We could not find that | It may have been deleted or you may not have access to it. | none |
| SEAT_LIMIT_REACHED | No seats left | Your Starter plan allows 5 people. Upgrade or add seats to invite more. | See plans |
| BILLING_RESTRICTED | Your team is in view-only mode | The last payment failed. You can view shifts, but changes are paused until the owner pays. | Fix payment |
| INVITE_EXPIRED | This invite has expired | Ask the person who invited you to send a new one. | none |
| SERVICE_UNAVAILABLE | Rota is busy right now | Too many people are using it at once. Try again in a few seconds. | Try again |
| INTERNAL | Something went wrong on our side | Your data is safe. Try again, and contact support if it keeps happening. | Try again |

**Server change needed:** extend the error shape to `{ error: { code, message, requestId, fields? } }` where `fields` maps field names to stable codes (for example `{ "password": "PASSWORD_TOO_SHORT" }`). The app turns codes into the copy above and never shows the server `message` directly.

### 6.3 Confirmation dialogs (delete and other destructive actions)

**Never delete on the first tap.** Every destructive action opens a Material 3 basic dialog.

**Anatomy:**
1. Optional alert icon in `error` color.
2. **Title as a question that names the thing:** "Delete this shift?"
3. **Body states the consequence and that it cannot be undone:** "This removes Friday 9:00 to 17:00 for Ama and cancels 1 pending swap request. This cannot be undone."
4. Two actions. **Cancel** on the left (text button). **The specific verb** on the right ("Delete shift") in `error` color.
5. Cancel is the safe default: back button, tapping outside, and Cancel all dismiss.
6. While the request runs, both buttons are disabled and the confirm button shows progress. Tapping outside does nothing.
7. If the request fails, the dialog stays open with the error under the message.
8. After success, close the dialog and show a snackbar: "Shift deleted".

**Copy for each destructive action:**

| Action | Title | Body | Confirm button |
|---|---|---|---|
| Delete shift | Delete this shift? | This removes {day, time} for {name} and cancels {n} pending swap requests. This cannot be undone. | Delete shift |
| Remove member | Remove {name} from the team? | They lose access to {team} and their upcoming shifts become unassigned. Their seat becomes free. | Remove member |
| Cancel swap request | Cancel this swap request? | {Manager} will no longer see it. You can request again later. | Cancel request |
| Reject swap | Reject this swap? | {Name} keeps the shift and is notified. | Reject swap |
| Log out of all devices | Log out of all devices? | You will be logged out here and on every other device. You will need to log in again. | Log out everywhere |
| Schedule a downgrade | Downgrade at the end of this period? | Your plan changes to {Plan} on {date}. You keep the current plan until then. No refund is issued. | Schedule downgrade |
| Remove seats | Remove {n} seats at renewal? | Your price changes on {date}. Seats in use must be freed first. | Remove seats |

For the most destructive actions that cannot be reversed and affect many people (for example deleting a whole team, if added later), use **type-to-confirm**: the confirm button stays disabled until the user types the team name. The `ConfirmDialog` supports this with `requireText`.

### 6.4 Success feedback

| Level | Component | Use for |
|---|---|---|
| 1 | Snackbar, 4 seconds, no action or "Undo" where undo exists | Shift saved, shift deleted, swap requested, settings saved, member removed |
| 2 | **Result dialog** with a success icon, a title, one sentence, one button | Account created, team created, invite sent, plan changed or payment confirmed, swap approved |

The dialog has a check-circle icon in `success`, a centered title, a short message about what happens next, and one text button with a specific label ("Create team", "View team", "Done").

Design note: a modal for every success interrupts people, and Material 3 guidance prefers snackbars for small confirmations. Rota uses dialogs for milestone moments. To promote any Level 1 event to a dialog, change that one call site. Do not stack a dialog and a snackbar for the same event.

### 6.5 Loading, empty, and offline states

- **Loading:** a skeleton that matches the layout (grey tonal blocks, no shimmer gradient). A spinner only inside buttons.
- **Empty:** one icon, one title, one sentence, one action. Example: "No swap requests. When someone asks to swap a shift, it will show up here."
- **Error:** icon, title, message, "Try again".
- **Offline:** banner with the time the data was last updated. Write actions that need a connection are disabled with an explanation.

---

## 7. Accessibility

- Contrast of at least 4.5 to 1 for text and 3 to 1 for borders and icons (values in section 2.3).
- Touch targets of at least 48 dp. Navigation destinations are at least that wide.
- Every icon button, switch, and image has an accessibility label. Selected tabs announce their state. Badges announce the count ("Swaps, 3 pending").
- Dynamic text size: layouts wrap or scroll. Test at 200%.
- Dialogs trap focus, announce their title, and return focus on close.
- Errors are announced (live region) and linked to their field.
- No information by color alone. Status chips and the password meter always include text.
- Respect "reduce motion".

---

## 8. Content style

- Plain, short, active voice. Sentence case. No exclamation marks. No filler such as "Oops" or "Welcome back".
- Buttons are verbs: "Add shift", "Send invite", "Approve swap". Avoid "OK", "Submit", "Yes", "No".
- Dates and times: "Fri 14 Oct, 09:00 to 17:00". Use the user's time zone. Respect the device 12 or 24 hour setting.
- Amounts: "$20.00" from cents. Show the currency code when it is not obvious.
- Say "swap request", "shift", "seat", and "team" consistently. Do not invent synonyms.

---

## 9. Figma setup (for the design file)

1. Open the Material 3 Design Kit published by the Material team in the Figma Community and duplicate it into your project.
2. Create variable collections from `tokens.ts`: Color (modes: Light and Dark), Spacing, Radius. Use the exact role names (`primary`, `onSurface`, `surfaceContainer`).
3. Create text styles from the type scale in section 2.4.
4. Build frames at 360 by 800 (phone) and 840 by 1180 (tablet with rail). Use auto layout and the 4 dp grid.
5. Design every state: loading, empty, error, offline, restricted, and the dialogs in section 6.
6. Prototype the five critical flows: sign up with password strength, invite and accept, request and approve a swap, delete a shift, change plan with proration preview.
7. Name components after their code names (`ConfirmDialog`, `PasswordField`, `AppTabBar`, `ScreenHeader`) so handoff matches the repo.
8. Keep the Figma link for the README and your portfolio case study.

## 10. Implementation map

| Design element | Code |
|---|---|
| Tokens (colors, space, shape, type) | `app/src/ui/tokens.ts` |
| Paper theme, no shadows, tonal surfaces | `app/src/ui/theme.ts` |
| Navigation bar | `app/src/ui/components/AppTabBar.tsx` (Paper `BottomNavigation.Bar`) with `expo-router/js-tabs` |
| Top app bar | `app/src/ui/components/ScreenHeader.tsx` (Paper `Appbar.Header`) |
| Password field and strength | `app/src/ui/components/PasswordField.tsx`, `passwordStrength.ts` |
| Confirm and success dialogs | `ConfirmDialog.tsx`, `ResultDialog.tsx` |
| Error copy | `app/src/ui/errorMessages.ts` |
| Examples | `app/src/ui/examples/` (tab layout, sign up screen) |

Library: `react-native-paper` 5.x (Material Design 3). Install with `npx expo install react-native-paper react-native-safe-area-context @expo/vector-icons`.

## 11. UI definition of done

- [ ] Uses only tokens and Paper components. No raw hex, no random spacing
- [ ] No shadows, no gradients
- [ ] Loading, empty, error, offline, and restricted states exist
- [ ] Destructive actions use the confirmation dialog
- [ ] Errors use the message library and keep the user's input
- [ ] Labels on every icon button, 48 dp targets, text scales to 200%
- [ ] Works in light and dark theme
- [ ] Checked against the "does this look generated" list (section 2.2)
