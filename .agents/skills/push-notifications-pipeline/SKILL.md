---
name: push-notifications-pipeline
description: Use when building Rota push notifications: device token registration, the notification queue and worker, Expo push tickets and receipts, invalid token cleanup, type toggles, quiet hours, retries, and tap-to-open deep links. Covers requirements FR-N1 to FR-N7 and proof tests T10 and T14.
---

# Push notifications pipeline

## The one big rule

The request that causes a notification only **enqueues a job**. It never sends. Sending is slow and can fail. If it ran inside the request, a push outage would make "approve swap" slow or broken. With a job, the approval succeeds at once and the push retries on its own.

## Flow

```
HTTP handler (swap approved)
  -> same DB transaction: update swap, write activity event
  -> after commit: queue.add('notify', { type, teamId, entityId, recipients, urgent, requestId })
Worker 'notify'
  -> for each recipient: load settings and devices
  -> skip if type toggled off
  -> quiet hours check (see settings skill) -> delay or send
  -> build messages, send to Expo Push Service in chunks
  -> save tickets
Worker 'push-receipts' (delayed job about 15 minutes after send)
  -> fetch receipts -> delete devices with DeviceNotRegistered
```

## Device registration (FR-N1)

App, after login (and after granting permission): get the Expo push token and call `POST /v1/devices { expoPushToken, platform, deviceId }`.

```
devices(id, user_id, expo_push_token unique, platform, device_id, last_seen_at, created_at)
```

- Upsert on `expo_push_token`. If the token already belongs to another user (shared phone), move it to the new user.
- One user can have many devices. `deviceId` identifies the install.
- On logout: `DELETE /v1/devices/:id`. On logout-all: delete all of the user's devices.
- Validate the token shape on the server (`ExponentPushToken[...]` or the format `expo-server-sdk` accepts with `Expo.isExpoPushToken`).

## Notification types (FR-N5)

| Setting key | Events |
|---|---|
| `shift_changes` | shift created, updated, deleted, assigned to you |
| `swaps` | swap requested (to managers and target), approved, rejected |
| `billing` | payment failed, grace reminders, restricted, payment received |

Stored in `user_settings.notif_types` as `{ shift_changes: true, swaps: true, billing: true }` with its own `updated_at`. Billing notifications go only to the owner.

## Urgency (PRD A9)

`urgent = true` when a shift that starts within the next 2 hours is changed or cancelled. Urgent ignores quiet hours. Everything else waits. The producer sets the flag, the worker enforces it.

## Worker logic

```ts
async function processNotify(job) {
  const { type, recipients, urgent, payload } = job.data;
  for (const userId of recipients) {
    const settings = await settingsRepo.get(userId);           // from the primary
    if (!settings.notifTypes[typeKey(type)]) continue;
    if (!urgent) {
      const releaseAt = nextAllowedTime(new Date(), settings.timezone,
                                        settings.quietStart, settings.quietEnd);
      if (releaseAt) {
        await queue.add('notify-user', { userId, type, payload }, { delay: releaseAt.getTime() - Date.now() });
        continue;                                              // delayed, not dropped
      }
    }
    await sendToUserDevices(userId, type, payload);
  }
}
```

Process in small batches for large teams. Make `notify-user` idempotent: use a deterministic job id (`notify:${eventId}:${userId}`) so a retry cannot create duplicates.

## Sending with Expo

Use `expo-server-sdk`:
- `Expo.isExpoPushToken(token)` before sending.
- `expo.chunkPushNotifications(messages)` then `sendPushNotificationsAsync(chunk)`.
- Message: `{ to, title, body, data: { url: 'rota://shifts/<id>' }, sound: 'default', channelId: 'default', priority: 'high' }`.
- Save each ticket id with the device id in a small table or in the receipts job payload.
- If a ticket reports `DeviceNotRegistered` immediately, delete the device right away.

Receipts job (about 15 minutes later): `getPushNotificationReceiptsAsync(ids)`. For receipts with `details.error === 'DeviceNotRegistered'`, delete that device (T14). Log other errors with the receipt message.

Check the current Expo push docs for limits and credentials. Android remote push requires FCM credentials configured through EAS (see `eas-build-and-deep-links`).

## Retries (FR-N7)

Queue defaults: `attempts: 5`, `backoff: { type: 'exponential', delay: 2000 }`. After the last attempt the job stays in the failed set. Log every attempt: job id, attempt number, user id, outcome. Never retry on `DeviceNotRegistered` (delete the device instead).

## Deep links on tap (FR-N4)

Payload `data.url` examples: `rota://shifts/<shiftId>`, `rota://swaps/<swapId>`, `rota://billing`. In the app:

```ts
const ALLOWED = [/^rota:\/\/shifts\/[0-9a-f-]{36}$/, /^rota:\/\/swaps\/[0-9a-f-]{36}$/, /^rota:\/\/billing$/];
function handleTap(url?: string) {
  if (url && ALLOWED.some(r => r.test(url))) router.push(toRoute(url));
}
```

Handle both: app opened from a killed state (`Notifications.getLastNotificationResponseAsync()` on startup) and app already open (`addNotificationResponseReceivedListener`). The screen must handle a deleted or foreign shift gracefully (404 view with "This shift is no longer available").

## Android channel

Create a default notification channel at startup (`Notifications.setNotificationChannelAsync`). Foreground handler: show a banner so testing is visible.

## Tests

- **T10:** worker unit test with a fixed `now`: settings 22:00 to 06:00 in `Africa/Lagos`, notification at 02:00 local is delayed until 06:00 local. Urgent notification sends immediately. Type toggled off sends nothing.
- **T14:** mock the Expo client (this is the one place a mock is right) to return a `DeviceNotRegistered` receipt, run the receipts job, assert the device row is gone.
- A user with two devices gets two messages. A removed manager no longer receives swap notifications.
- Retry test: first attempt throws, second succeeds, only one push is delivered.
- Handler test: approving a swap returns before any push is sent (assert the queue has a job and the Expo client was not called inside the request).

## Manual proof on a real phone

Development build installed, log in on two devices, set quiet hours, trigger events. Record this for the demo video.

## Explain-back questions for the human

1. Why is sending a push inside the request a bad design? Give a concrete failure.
2. What happens to a notification created during quiet hours? Where is it stored while waiting?
3. Why do we check receipts 15 minutes later?
