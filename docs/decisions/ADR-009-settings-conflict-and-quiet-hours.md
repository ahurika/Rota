# ADR-009: Settings Synchronization Conflict Resolution, Quiet Hours Engine, and Push Device Management
Date: 2026-10-12   Status: accepted

## Problem
Users use Rota on mobile devices where network connectivity fluctuates and multiple devices may be linked to the same account (e.g., tablet and phone).
1. **Settings Conflicts**: Updating theme on one device must not overwrite quiet hours configured on another device.
2. **Quiet Hours Calculation**: Shift reminders and swaps must respect sleep schedules across diverse global timezones and Daylight Saving Time (DST) transitions, while urgent alerts must punch through.
3. **Dead Token Accumulation**: When users uninstall the Expo app or reset push tokens, stale device tokens must not accumulate or cause notification delivery degradation.

## Options considered
1. **Object-Level Last Write Wins (Single `updated_at`)**:
   - Pros: Simple single timestamp on `user_settings` row.
   - Cons: Coarse granularity causes destructive updates. For example, changing the app theme to "dark" on a tablet would overwrite a quiet-hours schedule adjusted moments earlier on a smartphone if the tablet sync arrived second.
2. **Client-Side Conflict Resolution with CRDTs / Operational Transformation**:
   - Pros: Complex merging logic.
   - Cons: Massive architectural complexity and overhead for simple key-value user preferences.
3. **Column-Level Last-Write-to-Arrive + Pure Luxon Quiet Hours Engine + Receipt-Driven Pruning (Chosen)**:
   - **Column-Level Timestamps**: Every configurable field in `user_settings` has an independent `updated_at_*` timestamp (`updated_at_quiet_start`, `updated_at_quiet_end`, `updated_at_timezone`, `updated_at_notif_types`, `updated_at_language`, `updated_at_theme`).
   - **Patch Semantics**: PATCH requests only modify the columns specified in the payload and only bump the corresponding `updated_at_*` columns.
   - **Pure Deterministic Quiet Hours Engine**: A zero-I/O function `calculateQuietHoursDelay(now, quietStart, quietEnd, timezone)` implemented using Luxon. Handles cross-midnight wrapping (e.g. 22:00 to 06:00), same-day daytime windows, and DST offsets cleanly without wall-clock drift.
   - **Urgent Notification Exemption**: Messages with `isUrgent: true` bypass quiet hours delays and send immediately.
   - **Receipt-Driven Device Pruning**: The background worker inspects Expo push ticket/receipt statuses. Any device returning `DeviceNotRegistered` is deleted from the `device_push_tokens` table immediately.

## Decision
We adopted Option 3: column-level timestamp tracking in PostgreSQL, a pure Luxon-powered quiet hours engine, and automated receipt-driven device token pruning.

## Why
1. **Non-Destructive Sync**: Edits to distinct settings fields never clobber each other across devices.
2. **Verifiable Time Math**: The quiet hours engine accepts `now` as a pure parameter, making test verification deterministic and clock-independent (verified across 6 table cases in Proof Test T10).
3. **Clean Push Token Hygiene**: Prevents wasted API quota and latency overhead by automatically culling uninstalled devices (verified in Proof Test T14).

## Consequences
- The `user_settings` schema carries individual timestamp columns for each configuration setting.
- Notification dispatch is strictly decoupled from request execution into background worker queues.
- Timezone validation requires valid IANA timezone strings via Luxon.
