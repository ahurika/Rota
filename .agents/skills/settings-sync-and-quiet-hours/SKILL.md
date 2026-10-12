---
name: settings-sync-and-quiet-hours
description: Use when building Rota user settings (quiet hours, time zone, notification types, language, theme), syncing them across devices, resolving conflicts with server updatedAt, optimistic updates with rollback, or the quiet hours calculation in the notification worker. Covers FR-ST1 to FR-ST5 and test T10.
---

# Settings coordination and quiet hours

## Idea in one sentence

The server holds the single source of truth for settings. Devices load and cache them. The notification worker obeys them.

## Table

```
user_settings(
  user_id pk,
  quiet_start text,   quiet_start_updated_at timestamptz,
  quiet_end text,     quiet_end_updated_at timestamptz,
  timezone text,      timezone_updated_at timestamptz,   -- IANA name, e.g. Africa/Lagos
  notif_types jsonb,  notif_types_updated_at timestamptz,
  language text,      language_updated_at timestamptz,
  theme text,         theme_updated_at timestamptz
)
```

Time values are `HH:MM` 24-hour strings. Validate the time zone with Zod by trying `DateTime.now().setZone(tz).isValid` (Luxon). `quiet_start == quiet_end` means quiet hours are off.

## API

```
GET   /v1/settings
PATCH /v1/settings   { quietStart?, quietEnd?, timezone?, notifTypes?, language?, theme? }
```

PATCH changes only the fields sent. For each field sent, the server sets that field's `*_updated_at = now()` (**server time**, never a client time). Response returns the full settings object including each `updatedAt`.

## Conflict rule (A10) and its weakness

- Rule: each field has a server `updatedAt`. The last write to arrive at the server wins.
- Why: simple, no client clock problems.
- **Weakness (write this in `ARCHITECTURE.md` and answer it in interviews):** it is the last write to *arrive*, not the last edit *made*. If a user changes quiet hours on a phone that is offline, then changes them on a tablet that is online, the phone's older edit overwrites the tablet's newer edit when the phone reconnects. The alternatives are client timestamps (clock skew risk) or version vectors (more complex).
- Mitigation in the app: when an offline write is queued, store the `baseUpdatedAt` the device last saw. The server may reject a field with 409 if the stored `updatedAt` is newer than `baseUpdatedAt` and return the current value. The app then shows "Updated on another device" and refreshes. Decide whether to implement this mitigation and record it in `ADR-009`. If not implemented, say so plainly.

## Cross-device sync (FR-ST2)

- Query key `['settings']`, `staleTime: 0`.
- Refetch on app launch and when the app returns to the foreground. Wire TanStack Query's `focusManager` to React Native `AppState`:

```ts
import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
```

- Apply theme and language from the fetched settings. A change on the phone appears on the tablet the next time the tablet is opened or foregrounded.

## Optimistic update with rollback (FR-ST4)

```ts
useMutation({
  mutationFn: patchSettings,
  onMutate: async (patch) => {
    await qc.cancelQueries({ queryKey: ['settings'] });
    const previous = qc.getQueryData(['settings']);
    qc.setQueryData(['settings'], (old) => ({ ...old, ...patch }));
    return { previous };
  },
  onError: (_e, _patch, ctx) => { qc.setQueryData(['settings'], ctx?.previous); showToast('Could not save. Reverted.'); },
  onSettled: () => qc.invalidateQueries({ queryKey: ['settings'] }),
});
```

## Quiet hours calculation (server, `lib/quietHours.ts`)

Verified implementation (Luxon). Returns the time to release a delayed notification, or `null` if sending is allowed now.

```ts
import { DateTime } from 'luxon';

export function nextAllowedTime(now: Date, tz: string, quietStart: string, quietEnd: string): Date | null {
  if (quietStart === quietEnd) return null;                 // quiet hours off
  const local = DateTime.fromJSDate(now, { zone: tz });
  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);
  const start = local.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const end = local.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
  const wraps = start > end;                                // e.g. 22:00 to 06:00 crosses midnight
  if (!wraps) return local >= start && local < end ? end.toJSDate() : null;
  if (local >= start) return end.plus({ days: 1 }).toJSDate();   // evening part: ends tomorrow morning
  if (local < end) return end.toJSDate();                        // early morning part: ends today
  return null;
}
```

Checked results (Lagos is UTC+1):

| Now (UTC) | Time zone | Quiet hours | Result |
|---|---|---|---|
| 2026-10-13 01:00Z (02:00 local) | Africa/Lagos | 22:00 to 06:00 | release 2026-10-13 06:00 local |
| 2026-10-12 21:30Z (22:30 local) | Africa/Lagos | 22:00 to 06:00 | release 2026-10-13 06:00 local |
| 2026-10-13 08:00Z (09:00 local) | Africa/Lagos | 22:00 to 06:00 | null (send now) |
| 2026-10-13 12:30Z (13:30 local) | Africa/Lagos | 13:00 to 15:00 | release 15:00 local |
| 2026-10-13 05:00Z (01:00 local) | America/New_York | 22:00 to 06:00 | release 06:00 local (-04:00) |
| any | any | 00:00 to 00:00 | null (off) |

Always pass `now` into the function so tests control time. Add tests for a time zone with daylight saving time (New York around the November change) to show the DST behaviour, and write down what you observe.

## Where the server enforces settings

- Notification worker: type toggles and quiet hours (see `push-notifications-pipeline`).
- Billing emails are not push, but still respect the language setting if you localise (language only stores the preference for this task).
- Settings reads in the worker always come from the primary database so a just-changed setting is obeyed.

## Tests

- **T10** (see push skill): 02:00 local delayed to 06:00 local.
- PATCH sets `updated_at` only on changed fields. Fields not sent keep their old time.
- Two PATCHes from two clients: the later arrival wins, and the response shows the winning value.
- Invalid time zone or time format returns 400.
- Optimistic rollback (app): mock a failing server, assert the cache is restored.

## Explain-back questions for the human

1. A user changes quiet hours offline on a phone, then on a tablet. Which wins, and why? What is the weakness?
2. Why does the worker, not the app, check quiet hours?
3. Why is the `updatedAt` set by the server instead of the phone?
