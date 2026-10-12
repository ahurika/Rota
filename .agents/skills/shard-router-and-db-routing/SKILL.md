---
name: shard-router-and-db-routing
description: Use when setting up Rota database connections: connection pooling and pool sizes, the two-database sharding simulation routed by a hash of team_id, read and write routing with read-your-own-writes, migrations across shards, and writing SHARDING.md. Covers the Task A backend system design requirements.
---

# Pooling, replica routing, and the sharding simulation

## Three ideas, three tiny stories

- **Pooling:** a taxi stand. A few taxis (connections) serve everyone. Without it, every passenger buys a car and the road (database) runs out of space.
- **Replica lag:** you post on a wall and the mirror copy updates a moment later. If you look at the mirror right away, you see the old post. Fix: for 5 seconds after you write, you read from the original wall.
- **Sharding:** two filing rooms. A rule (hash of `team_id`) says which room holds each team's files.

## Environment

```
DATABASE_URL_0, DATABASE_URL_1            primary connection strings (pooled strings from the provider)
DATABASE_URL_READ_0, DATABASE_URL_READ_1  read connection strings (may equal the primary in dev)
```

Local: two Postgres containers in `docker-compose.yml` on different ports. Hosted: two free-tier databases (check the provider's current limits). Never commit real URLs.

## Pooling (document the numbers in an ADR)

- Use the provider's pooled endpoint (PgBouncer style) or run PgBouncer.
- API process: `max: 10` per shard. Worker process: `max: 5` per shard. `connectionTimeoutMillis: 3000`, `idleTimeoutMillis: 30000`.
- Reasoning to write down: provider connection limit (for example 100 on a default Postgres) divided by number of processes, minus headroom for migrations and admin tools. Example: 2 API instances x 10 + 1 worker x 5 = 25 per shard, well under the limit.
- Prisma: set `connection_limit` in the URL or use the driver adapter pool settings, matching the numbers above. Check the current Prisma docs for your installed version because pool configuration changed across versions.
- A request that cannot get a connection within the timeout returns 503 with `Retry-After`.

## Shard router (`server/src/db/shards.ts`)

```ts
import { createHash } from 'node:crypto';
const SHARD_COUNT = 2;

export function hashShard(teamId: string): number {
  const first4 = createHash('sha256').update(teamId).digest().readUInt32BE(0);
  return first4 % SHARD_COUNT;
}

export async function shardFor(teamId: string): Promise<number> {
  const override = await overrides.get(teamId);   // team_shard_overrides table in database 0
  return override ?? hashShard(teamId);
}
```

Rules:
- Use a stable hash. Never `Math.random`, never JavaScript object order. The same team id must always map to the same shard.
- `db.forTeam(teamId)` returns the client for that shard. Services never see the other shard.
- Write a unit test: 1,000 random uuids map to 0 or 1 about evenly (within a loose tolerance) and the same id always maps to the same shard.

## Where data lives

| Place | Tables |
|---|---|
| Shard 0 or 1 by `hash(team_id)` | teams, memberships, invites, shifts, swap_requests, activity_events, subscriptions, ledger_entries, payment_attempts, webhook_events |
| Always database 0 (global) | users, refresh_tokens, magic_links, password_resets, devices, user_settings, team_directory, team_shard_overrides, idempotency_keys |

`team_directory(user_id, team_id, role, shard)` answers "which teams is this user in" without asking both shards. Update it in the same flow as membership changes. If a write to the shard succeeds and the directory write fails, record a repair job (the outbox idea). Mention this honestly in `SHARDING.md` as a consistency risk across databases (no cross-database transaction).

## Read and write routing (read-your-own-writes)

```ts
export async function dbForRead(teamId: string, userId: string) {
  const shard = await shardFor(teamId);
  try {
    if (await redis.exists(`recent_write:${userId}`)) return primary(shard);
  } catch { return primary(shard); }          // Redis down: primary is the safe choice
  return replica(shard);
}
export async function markWrite(userId: string) {
  await redis.set(`recent_write:${userId}`, '1', 'EX', 5);
}
```

Call `markWrite(userId)` from the middleware after any successful mutating request. Money, settings, and auth reads always use the primary regardless.

In development the read string can point to the same database. Write in `ARCHITECTURE.md` what changes in production: a real replica, replication lag monitoring, and a failover plan.

## Migrations across shards

`npm run db:migrate` runs the same schema migrations on both databases, and the global-table migrations only on database 0. Record applied migrations per database. Never edit an applied migration.

## Writing SHARDING.md (deliverable)

Sections to include, in your own words:

1. **Shard key and why:** `team_id`, because all of a team's data is queried together and a dashboard hits one shard.
2. **How it routes:** hash then modulo, plus override table.
3. **Very large team:** one team with a huge activity feed becomes a hot shard. Plan: set an entry in `team_shard_overrides` and move that team's rows to a dedicated database with a copy-then-switch migration (dual write window, verify counts, flip the override).
4. **Queries that became harder:** "all teams for a user" (needs `team_directory`), "all past-due subscriptions" (scatter-gather across shards), cross-team reporting, any unique constraint that must hold across teams.
5. **Weaknesses:** database 0 holds global tables plus its team share so it takes more load. No cross-shard transactions. Changing the shard count later needs a data migration (consider consistent hashing or a lookup table).
6. **When it fails:** one viral team (hot shard), a team that must move shards, a report that needs everything.

## Tests

- Same team id always routes to the same shard. Distribution is roughly even.
- Creating two teams that land on different shards: each team's data is found only through its own shard connection.
- Read-your-own-writes: write, then read immediately, assert the read used the primary (spy on `dbForRead`). After 5 seconds, reads may use the replica.
- Redis down: reads go to the primary and the request still succeeds.

## Explain-back questions for the human

1. Why `team_id` as the shard key? When does it fail?
2. What does the 5-second rule fix? What breaks if Redis is down?
3. Why can't one transaction cover both a shard and the global database?
