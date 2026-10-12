# ADR-006: Keyset Cursor Pagination for Activity Feed
Date: 2026-10-12   Status: accepted

## Problem
In a mobile shift-scheduling application, the activity feed reflects fast-moving team events (shift assignments, updates, swap requests). Standard offset-based pagination (`OFFSET 20 LIMIT 20`) causes two severe issues:
1. **Skips and Repeats**: If new rows arrive at the top while the user views page 1, rows shift downwards; fetching page 2 repeats items already shown or misses items.
2. **Performance Degradation**: `OFFSET n` forces the database to read and discard `n` rows ($O(n)$ cost), causing sluggish queries deep into the feed.

## Options considered
1. **Offset-Based Pagination (`OFFSET n LIMIT 20`)**:
   - Pros: Simple to implement.
   - Cons: Flawed user experience during live writes; quadratic query cost at high offsets.
2. **Timestamp-Only Cursor (`created_at < cursor`)**:
   - Pros: Better than offset.
   - Cons: Fails when multiple events share identical timestamps (common under batch operations or automated shifts). Rows sharing that timestamp are either skipped or repeated.
3. **Composite Keyset Cursor `(created_at, id) < (cursor_time, cursor_id)` with `timestamptz(3)`**:
   - Pros:
     - Guarantees deterministic, stable ordering even if hundreds of items share the exact same timestamp.
     - New items inserted at the top do not shift the cursor position.
     - Backed by composite index `(team_id, created_at DESC, id DESC)`, queries stream directly from the index in $O(1)$ time (measured at **0.081 ms** execution time on 10,000+ rows vs **7.010 ms** before index).
     - Millisecond precision (`timestamptz(3)`) avoids rounding discrepancies between Node.js / JavaScript dates and PostgreSQL timestamps.
   - Cons: Cannot jump directly to arbitrary page numbers (e.g. "Page 42"), which is unnecessary for mobile infinite-scroll feeds.

## Decision
We chose the composite keyset cursor pagination model (`created_at DESC, id DESC`) with base64url encoded opaque cursors (`{"t": ISOString, "i": bigintId}`).

## Why
1. Satisfies PRD Section 7, FR-F1, FR-F2, and Proof Test T9.
2. Eliminates both data inconsistency (no duplicate or missing items) and server load under concurrent mobile activity.
3. Proven by EXPLAIN ANALYZE evidence in `docs/performance/` and `docs/ARCHITECTURE.md`.

## Consequences
- The mobile app feed will consume `nextCursor` and implement React Query / `useInfiniteQuery`.
- In production, migrations creating feed indexes should run `CREATE INDEX CONCURRENTLY` outside of transaction blocks.
