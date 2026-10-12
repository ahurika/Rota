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
