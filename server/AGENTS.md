# AGENTS.md: server

Applies to everything under `server/`. Root `AGENTS.md` and `PRD.md` still apply.

## Layout

```
server/
  src/
    app.ts                 Hono app, middleware order
    index.ts               HTTP entry point
    worker.ts              Queue workers entry point (separate process)
    config/                env parsing (Zod), plans.ts (prices, caps)
    routes/                HTTP handlers only: parse, call service, respond
    services/              Business rules (billing, swaps, invites, feed)
    repositories/          All SQL and Prisma calls, one module per aggregate
    db/                    shard router, pools, read routing, migrations
    jobs/                  Queue definitions and processors
    lib/                   logger, errors, crypto, redis, idempotency, rate-limit
    middleware/            requestId, auth, requireRole, rateLimit, idempotency
  prisma/ or migrations/   Schema and SQL migrations
  test/                    Vitest tests (unit, integration)
```

## Layer rules

1. Routes never touch the database. Routes call services.
2. Services never read `process.env`. They use `config/`.
3. Repositories always take `teamId` for team-scoped data and always include it in the query.
4. Billing math lives in `services/billing/proration.ts` as pure functions with no I/O.
5. Every route declares its Zod schema and its required role in one place at the top of the file.
6. One error class (`AppError`) with a stable `code`. Handlers return `{ error: { code, message, requestId } }`.

## Middleware order

`requestId` then `logger` then `sentry` then `rateLimit (IP)` then `auth` then `rateLimit (user)` then `requireRole` then `idempotency (where needed)` then the handler.

## Testing

- Vitest with real Postgres and Redis from docker compose (no mocks for the database).
- Each test file creates its own team and users so tests do not depend on each other.
- Required proof tests are listed in `PRD.md` section 11 (T1 to T14). Keep a table of their status in `docs/test-results/README.md`.
- Run `npm run test` before every commit.

## Migrations

- Every migration is a new file. Never edit an applied migration.
- Index changes for performance work are separate migrations so "before" and "after" query plans can be captured.
- The ledger trigger that blocks UPDATE and DELETE is part of the ledger migration.
