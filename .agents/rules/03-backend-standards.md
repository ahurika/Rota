---
trigger: glob
globs: server/**
---

# Rule 03: Backend system design standard

**Activation:** Glob `server/**`.

## Request pipeline

Order: request id, structured log, Sentry, IP rate limit, auth, user rate limit, role check, idempotency (where needed), Zod validation, handler. Return one error shape: `{ error: { code, message, requestId } }`.

## Database access

1. All SQL lives in `repositories/`. Services and routes never write SQL.
2. Team data is reached only through the shard router (`db.forTeam(teamId)`). Never import a raw pool in a service.
3. Every team-scoped query includes `team_id` in the `WHERE` clause. Joins also filter on `team_id`.
4. Multi-step changes use a transaction. A change and its activity event are written in the same transaction.
5. Use parameters (`$1`), never string-built SQL.
6. Use `timestamptz` for time. Use `timestamptz(3)` for `activity_events.created_at` so cursor values round-trip exactly through JavaScript dates.

## Connection pooling

1. Use the provider's pooled connection string (Neon or Supabase pooler) or PgBouncer.
2. API process: pool max 10 per shard. Worker process: pool max 5 per shard. Write the reasoning in an ADR: provider connection limit, number of processes, headroom for migrations and admin tools.
3. Set `connectionTimeoutMillis` and `idleTimeoutMillis`. A request that cannot get a connection fails fast with 503, it does not hang forever.
4. Never open a connection per request.

## Read and write routing (see skill `shard-router-and-db-routing`)

1. Writes go to the primary.
2. Reads may use the read connection string. After any write by a user, that user reads from the primary for 5 seconds (Redis key `recent_write:{userId}` with TTL 5). If Redis is unavailable, read from the primary.
3. Without a real replica, point the read string at the same database in development and document what changes in production.

## Sharding simulation

1. Two PostgreSQL databases. Shard key `team_id`. `shardIndex = uint32(sha256(teamId)[0..4]) % 2`.
2. Check `team_shard_overrides` before hashing (for very large teams).
3. Global tables (users, tokens, devices, settings, `team_directory`) live in database 0. Document this weakness in `docs/SHARDING.md`.
4. Never write a query that joins across shards. Cross-shard reads use scatter-gather in the service layer and are documented as "harder queries".

## Caching (see skill `redis-cache-and-rate-limit`)

1. Cache-aside. Every key has a TTL. Invalidate explicitly when data changes.
2. Cache only: team rosters, shift calendar ranges, activity feed pages, TMDB-style slow reads if added.
3. Never cache: subscription status, payment status, balances, ledger, webhook or idempotency records, role and permission checks.
4. Use versioned keys (`teamver:{teamId}` counter inside the key) instead of `KEYS` or `SCAN` deletes.
5. Document what is and is not cached in `docs/ARCHITECTURE.md`.

## Rate limiting

1. Redis only. Fixed window using an atomic Lua script or `INCR` plus `PEXPIRE`. Never an in-memory object.
2. Limits per IP and per user on: login, register, magic link, password reset, invites, billing, and the activity feed.
3. Return 429 with a `Retry-After` header.

## Background jobs (BullMQ)

1. Queues: `notifications`, `webhooks`, `email`, `billing`.
2. Defaults: `attempts: 5`, `backoff: { type: 'exponential', delay: 2000 }`, `removeOnComplete` with a cap, keep failed jobs.
3. Jobs are idempotent. Running a job twice must not double charge, double send, or double write.
4. Request handlers enqueue and return. They never send push, send email, or call slow third parties inline.
5. Workers run as a separate process (`worker.ts`). Each attempt is logged with job id, attempt number, and outcome.

## Observability (see skill `load-testing-and-observability`)

1. Structured JSON logs (pino) with `requestId`, `userId`, `teamId`, `route`, `status`, `durationMs`.
2. Propagate the request id into jobs so one payment can be traced from request to webhook to ledger.
3. Sentry on server and worker. You must be able to answer "what happened to this user's payment at 3:14pm?" from logs.

## Errors

Use `AppError(code, httpStatus, message)`. Stable codes such as `FORBIDDEN`, `NOT_FOUND`, `SEAT_LIMIT_REACHED`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_FAILED`, `RATE_LIMITED`, `BILLING_RESTRICTED`.

## Performance evidence

When you add an index or a cache, capture before and after numbers (EXPLAIN ANALYZE, k6) and save them in `docs/performance/`. Do not claim an improvement without numbers.
