---
name: cursor-pagination-feed
description: Use when building the Rota activity feed endpoint, cursor pagination, the supporting database index, EXPLAIN ANALYZE evidence, the 10,000 record seed, or the FlashList infinite scroll screen. Covers timestamp plus id cursors, tie handling, precision, and the app behaviour.
---

# Cursor pagination for the activity feed

## Why not offset

`OFFSET 20` means "skip the first 20 rows". If 3 new rows arrive at the top while the user reads page 1, every row shifts down by 3. Page 2 then repeats 3 items the user already saw. Deletes can make rows vanish. A cursor says "give me items older than this exact item", so new items at the top never move the user's place.

## Table

```sql
CREATE TABLE activity_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id     uuid NOT NULL,
  type        text NOT NULL,          -- shift_created, shift_updated, swap_requested, swap_approved ...
  actor_id    uuid NOT NULL,
  entity_id   uuid,
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz(3) NOT NULL DEFAULT now()
);
```

Use `timestamptz(3)` (milliseconds). JavaScript dates only hold milliseconds. If the column kept microseconds, a cursor built from a JS date could skip or repeat rows that share the same millisecond.

## Query

Sort by `(created_at DESC, id DESC)`. The id breaks ties when timestamps are equal.

```sql
SELECT id, type, actor_id, entity_id, payload, created_at
FROM activity_events
WHERE team_id = $1
  AND ( $2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::bigint) )
ORDER BY created_at DESC, id DESC
LIMIT $4;      -- pass limit + 1, so you know if another page exists
```

The row comparison `(created_at, id) < (a, b)` is a single comparison that treats the two columns as one sortable key. Do not write `created_at < a OR (created_at = a AND id < b)` by hand unless you test it, because it is easy to get wrong.

## Cursor format

Opaque to the client: base64url of `{"t":"2026-10-12T10:15:30.123Z","i":"9812"}`. Keep `i` as a string (bigint). Validate the decoded cursor with Zod. A bad cursor returns 400 `INVALID_CURSOR`.

Response:

```json
{ "items": [ ... ], "nextCursor": "eyJ0Ijoi..." , "hasMore": true }
```

Fetch `limit + 1` rows. If you got more than `limit`, drop the extra row, set `hasMore: true`, and build `nextCursor` from the last kept row. Limit default 20, max 50.

## Write path

Write the activity event in the **same transaction** as the change (shift created, swap decided). Then bump the team cache version (see `redis-cache-and-rate-limit`).

## Index and evidence (required)

1. Seed 10,000 or more events (see below). Make some share identical `created_at` values on purpose.
2. **Before:** with no supporting index, run
   `EXPLAIN (ANALYZE, BUFFERS) <the query with a mid-feed cursor>;`
   Save to `docs/performance/feed-explain-before.txt`. Expect a sequential scan plus a sort.
3. Create the index in its own migration:
   ```sql
   CREATE INDEX activity_team_created_id_idx
     ON activity_events (team_id, created_at DESC, id DESC);
   ```
   In production use `CREATE INDEX CONCURRENTLY` (note: it cannot run inside a transaction block).
4. **After:** rerun the same `EXPLAIN (ANALYZE, BUFFERS)` and save to `docs/performance/feed-explain-after.txt`. Expect an index scan and no separate sort.
5. In `docs/ARCHITECTURE.md`, paste the planning time, execution time, and scan type for both. Explain in your own words why the index column order matches the `WHERE` and `ORDER BY`.
6. Do not claim numbers you did not capture. If a table is too small for the planner to prefer the index, seed more rows or run `ANALYZE` first.

## Seed script

`npm run db:seed` must create, per run: a handful of teams across both shards, users in each role, shifts, and at least 10,000 activity events for the load-test team, spread across time with some exact timestamp ties. Print the counts at the end.

## App behaviour (FlashList)

- `useInfiniteQuery` with `getNextPageParam: (last) => last.hasMore ? last.nextCursor : undefined`.
- Guard `onEndReached`: only call `fetchNextPage()` if `hasNextPage && !isFetchingNextPage`. That prevents duplicate requests on fast scroll.
- Pull to refresh: `refetch()` of the first page. Reset the cursor chain.
- States: skeleton on first load, empty state ("No activity yet"), error state with retry, footer spinner while fetching next page, "You are all caught up" at the end.
- Merge pages and de-duplicate by `id` as a safety net.
- Items inserted while scrolling appear after pull to refresh (or a "New activity" pill), not by shifting the list under the user's thumb.

## Tests

- **T9:** create 60 events, some with identical timestamps. Page through with limit 20. Between page 1 and page 2, insert 3 new events. Assert: no id appears twice, no id from the original 60 is missing, order is strictly descending by `(created_at, id)`.
- Page size boundaries: exactly `limit` rows leaves `hasMore: false`. `limit + 1` rows leaves `hasMore: true`.
- Invalid cursor returns 400. A cursor from another team returns no rows from that team (team filter still applies).

## Explain-back questions for the human

1. What exactly breaks with offset when a new item arrives? Draw it with 6 items.
2. Why do we need `id` in the cursor if we already have `created_at`?
3. Why does the index column order matter?
