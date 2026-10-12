# Rota Architecture & Performance Evidence

## 1. System Overview
Rota is a multi-tenant shift scheduling and per-seat subscription platform designed for small teams (restaurants, clinics, retail). The architecture strictly enforces:
- **Zero Client Trust (Rule 01)**: All permissions, roles, seat limits, and business logic are evaluated server-side.
- **Two-Database Sharding Simulation**: Team data is partitioned across shards using `hashShard(teamId) = sha256(teamId)[0..4] % 2`. Global data lives on Database 0.
- **Append-Only Financial Ledger (Rule 02)**: Monies are recorded in integer cents.
- **Keyset Cursor Pagination**: Real-time activity feeds prevent duplicates, skips, and performance degradation.

---

## 2. Activity Feed Keyset Cursor Pagination & Index Analysis

### The Problem with Offset Pagination
Standard `OFFSET n LIMIT m` pagination re-scans `n` rows on every request ($O(n)$ complexity). Worse, in a high-concurrency activity feed, if 3 new events are inserted at the top of the feed while a user views Page 1, subsequent `OFFSET 20` requests repeat the last 3 items from Page 1 and shift the user's view.

### The Solution: Composite Keyset Cursor
We index and paginate using `(team_id, created_at DESC, id DESC)`. The query comparison:
```sql
WHERE team_id = $1
  AND ( $2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::bigint) )
ORDER BY created_at DESC, id DESC
LIMIT $4;
```
- Millisecond precision (`timestamptz(3)`) matches JavaScript `Date` precision.
- The `id` (bigint identity) breaks ties when multiple events share identical millisecond timestamps.
- Cursors are serialized as base64url JSON strings containing `{ t: ISOString, i: string }`.

---

## 3. Query Plan Verification Evidence (10,050 Seeded Rows)

Performance evidence was gathered on a real PostgreSQL 17 shard containing **10,050** activity events for the load-test team (`79113950-8305-4f31-99ff-f0d7e88a62ba`), querying from a mid-feed cursor (`id = 5113, created_at = 2026-09-01T16:49:00.000Z`).

### Comparison Summary

| Metric | Before Index | After Index (`activity_team_created_id_idx`) | Improvement |
|---|---|---|---|
| **Scan Type** | `Seq Scan on activity_events` | `Index Scan using activity_team_created_id_idx` | Eliminated full table scan |
| **Sort Node** | `Sort Method: top-N heapsort` (Memory: 30kB) | **None** (Index already ordered) | Eliminated sorting cost |
| **Buffers** | `shared hit=184` | `shared hit=4` | **46x fewer buffer hits** |
| **Planning Time** | 0.961 ms | 0.196 ms | **4.9x faster** |
| **Execution Time** | **7.010 ms** | **0.081 ms** | **86.5x faster** |

### Why Index Column Order Matters: `(team_id, created_at DESC, id DESC)`
1. **Equality First (`team_id`)**: The query always filters on a specific tenant. Placing `team_id` as the leading column allows the B-tree to jump directly to the team's partition.
2. **Range & Order Second (`created_at DESC`)**: Events are displayed in reverse chronological order. Ordering the B-tree descending enables index-ordered range scans without an in-memory sort.
3. **Tie-Breaker Last (`id DESC`)**: When multiple events share the exact same timestamp, the B-tree traverses rows strictly by descending `id`. The query engine directly streams `LIMIT 21` rows off the index pages and halts.

### Full Evidence Artifacts
- [docs/performance/feed-explain-before.txt](performance/feed-explain-before.txt)
- [docs/performance/feed-explain-after.txt](performance/feed-explain-after.txt)

---

## 4. Mobile Architecture & Offline Strategy (Rule 04)

The Rota mobile application is built with Expo SDK 52, React Native 0.76, Expo Router, and TanStack Query v5.

- **State Classification**: Clear separation across Server State (TanStack Query), Client-only UI State (Zustand), Persisted Offline State (AsyncStorage Persister whitelist), and Hardware-Backed Secrets (`expo-secure-store`). See [docs/STATE.md](STATE.md).
- **Concurrency & Token Safety**: Single in-flight refresh coalescing in `ApiClient` prevents duplicate refresh calls that trip PostgreSQL refresh token family reuse detection (Proof Test T4).
- **Offline Shift Access**: Shifts and roster persist to disk with a 24-hour TTL, enabling full schedule review in subway/airplane offline mode with explicit "Last updated" timestamps and NetInfo state handling.
- **High-Performance Infinite Scrolling**: The activity feed is rendered using Shopify `FlashList` with guarded `onEndReached` handlers (`!isFetchingNextPage && hasNextPage`), item deduplication, and zero UI stuttering over 10,000+ records.

---

## 5. Billing, Proration Math, and Append-Only Ledger (Rule 02)

### Money and Pricing Model
- All prices are represented strictly as integer cents (USD minor units) in `server/src/config/plans.ts`.
- Floating-point numbers are strictly forbidden for financial calculations.

### Proration Math & Rounding Rule
Proration is computed via a pure, zero-I/O function `prorateChange` (`server/src/services/billing/proration.ts`):
```
creditCents = Math.floor((oldMonthly * remainingDays) / periodDays)
costCents   = Math.floor((newMonthly * remainingDays) / periodDays)
chargeCents = costCents - creditCents
```
- **Rounding rule**: Unused credit and new cost are floored separately, then subtracted. All results are integer cents. Verified by Proof Test T3 Case 12.
- **Direction rule**: Upgrades are applied immediately with `chargeCents > 0`. Downgrades are scheduled for renewal with `chargeCents = 0` (no refunds).

### Ledger Immutability & Rebuilding State
- The `ledger_entries` table is strictly append-only. PostgreSQL triggers (`trigger_block_ledger_mutation` and `trigger_block_ledger_truncate`) abort any SQL `UPDATE`, `DELETE`, or `TRUNCATE` operations (Proof Test T11).
- Subscription state is fully reconstructible by replaying chronological ledger entries via `rebuildSubscriptionFromLedger(teamId)` (Proof Test T12).
- Ledger entries record: `type` (`charge` | `adjustment` | `credit` | `refund`), `amount_cents` (positive integer for charges), `plan`, `seats`, and a unique `idempotency_key = 'attempt:' || attempt.id`.

### Webhook Security & Idempotency
- **Cryptographic Verification**: Webhooks from Paystack are verified via HMAC SHA-512 against raw request text before parsing JSON, compared with constant-time equality `crypto.timingSafeEqual` (Proof Test T6).
- **Idempotent Ingestion**: `webhook_events` enforces a unique constraint on `(provider, event_id)`. Duplicate webhook deliveries return 200 OK immediately without triggering duplicate ledger charges (Proof Test T5).

---

## 6. Push Notifications, Device Tokens, and Settings Synchronization

### Asynchronous Notification Pipeline
- **Producer / Worker Separation**: HTTP request handlers never send push notifications synchronously. Activity events and mutation handlers enqueue background notification jobs with `recipientUserId`, `title`, `body`, `category`, and `isUrgent`.
- **Category Filtering**: Notifications check user-configured category toggles (`shift_changes`, `swaps`, `billing`) before dispatch. If a user disabled that category and the message is not urgent, delivery is skipped.

### Quiet Hours Engine (Proof Test T10)
- **Time Zone Aware**: Evaluated using Luxon against the recipient's configured IANA timezone (e.g. `Europe/London`, `America/New_York`).
- **Deterministic Math**: Pure function `calculateQuietHoursDelay(now, quietStart, quietEnd, timezone)` computes exact delay milliseconds without side effects.
- **Cross-Midnight Handling**: Properly handles intervals that cross midnight (e.g. 22:00 to 06:00) as well as daytime quiet hours (e.g. 13:00 to 15:00) and daylight saving transitions.
- **Urgent Notification Exemption**: Messages marked with `isUrgent: true` (e.g., emergency cancellations or high-priority broadcasts) bypass quiet hours delays and deliver immediately.

### Device Token Management & Receipt Handling (Proof Test T14)
- **Expo Push Tokens**: Mobile devices register their Expo push tokens via `POST /v1/devices`, recording platform (`ios` | `android`) and optional `device_id`.
- **Dead Token Cleanup**: Push tickets and receipts returned by Expo are inspected. When a receipt returns `status: 'error'` with `details.error === 'DeviceNotRegistered'`, the device row is immediately deleted from the database to prevent futile future delivery attempts.
- **Logout Cleanup**: User logout triggers `DELETE /v1/devices/:id`, ensuring revoked devices no longer receive alerts.

### Settings Synchronization & Conflict Resolution
- **Field-Level Timestamps**: The `user_settings` table maintains independent `updated_at_*` timestamps for every configurable field (`updated_at_quiet_start`, `updated_at_quiet_end`, `updated_at_timezone`, `updated_at_notif_types`, `updated_at_language`, `updated_at_theme`).
- **Conflict Resolution**: Last-write-to-arrive per field wins. If a client updates their `theme` offline while another client modifies `quietStart`, both updates merge cleanly without overwriting each other's independent modifications.
