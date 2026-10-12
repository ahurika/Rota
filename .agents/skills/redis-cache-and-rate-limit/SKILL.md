---
name: redis-cache-and-rate-limit
description: Use when adding Redis to Rota: cache-aside caching for rosters, shift calendars, and the activity feed with versioned keys and TTLs, explicit invalidation, Redis rate limiting for login, reset, invites, payments and feed, BullMQ connection settings, and failure behaviour when Redis is down.
---

# Redis: caching and rate limiting

## What goes in Redis

| Use | Key pattern | TTL |
|---|---|---|
| Team version counter | `teamver:{teamId}` | none (integer) |
| Roster cache | `roster:{teamId}:v{ver}` | 300 s |
| Calendar cache | `cal:{teamId}:v{ver}:{from}:{to}` | 60 s |
| Feed page cache | `feed:{teamId}:v{ver}:{cursor or 'first'}:{limit}` | 15 s |
| Rate limit counter | `rl:{route}:{ip or userId}:{windowStart}` | window length |
| Recent write marker | `recent_write:{userId}` | 5 s |
| Token version | `tv:{userId}` | see auth skill |
| Queues | BullMQ keys | managed by BullMQ |

Use hosted Redis (Upstash or the host's Redis). Use a TCP connection URL with `ioredis`. BullMQ needs `maxRetriesPerRequest: null` on its connection. Check the host's current command limits before choosing a free tier, because BullMQ polls Redis constantly (see `PRD.md` OQ3).

## Caching rules

1. **Cache-aside:** read cache, on miss read the database, write cache with a TTL, return.
2. **Every key has a TTL.** No exceptions (the version counter is the one deliberate exception).
3. **Explicit invalidation:** when a shift, member, or activity event changes, run `INCR teamver:{teamId}` in the same flow. Keys include the version, so old keys are never read again and expire on their own. This avoids slow `KEYS` or `SCAN` deletes.
4. **Never cache:** subscription status, payment status, balances, ledger rows, webhook or idempotency records, role and permission checks, or settings that workers must obey.
5. Document in `ARCHITECTURE.md` a table: what is cached, key, TTL, invalidation trigger, and "never cached" list with reasons.
6. If Redis is down, caches fall through to the database (log a warning). The app stays correct, just slower.

```ts
async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (e) { log.warn({ e }, 'cache read failed'); }
  const fresh = await load();
  try { await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec); } catch (e) { log.warn({ e }, 'cache write failed'); }
  return fresh;
}
```

Cache stampede note: on a cold key, many requests hit the database at once. For the feed's first page, add a short lock (`SET lock:{key} 1 NX EX 5`) so one request refills and others wait briefly or serve slightly old data. Write down whether you implemented it.

## Feed cache and the load test

Add an env flag `FEED_CACHE_ENABLED` (default true). The k6 report compares response times with the flag off and on. The cached response must still respect permissions: the cache key includes `teamId`, and the membership check runs before the cache lookup.

## Rate limiting (Redis, never in-memory)

Atomic fixed window with a Lua script, so increment and expiry cannot get out of sync:

```lua
-- KEYS[1] = counter key, ARGV[1] = window in ms
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { c, ttl }
```

```ts
export async function hit(key: string, limit: number, windowMs: number) {
  const [count, ttl] = await redis.eval(LUA, 1, key, windowMs) as [number, number];
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec: Math.ceil(ttl / 1000) };
}
```

On deny return 429 with `Retry-After`.

### Limits (starting values, tune and record in an ADR)

| Route | Per IP | Per user or email |
|---|---|---|
| `POST /auth/login` | 20 per 10 min | 5 failed per 15 min per email |
| `POST /auth/register` | 10 per hour | n/a |
| `POST /auth/magic-link` | 10 per hour | 3 per 15 min per email |
| `POST /auth/password-reset/request` | 10 per hour | 3 per hour per email |
| `POST /teams/:id/invites` | 60 per hour | 30 per hour per user |
| `POST /billing/*` | 30 per hour | 10 per hour per user |
| `GET /teams/:id/activity` | 600 per 10 min | 300 per 10 min per user |
| everything else | 1200 per 10 min | 600 per 10 min |

Client IP: behind a proxy, read the forwarded header only from the host's trusted proxy. Do not trust a header the client can set freely.

### When Redis is down

- Auth, invite, and billing routes: **fail closed** (503). A brute-force window is worse than a short outage.
- Read routes: fail open with a logged warning, or use a small in-process fallback with a very low limit. Pick one and record it.

### Load testing note

Do not weaken production limits. Use `LOADTEST_MODE=true` only when `NODE_ENV !== 'production'` to raise the feed limit for k6 (see `load-testing-and-observability`).

## Tests

- **T13:** hit a limit of 5 six times: the sixth returns 429 with `Retry-After`. After the window passes (use a short window in the test), it allows again.
- Per-IP and per-user counters are independent.
- Cache: first call loads from the database, second call is served from Redis (assert via a counter). After a shift change, the next call reloads (version bump).
- A cached calendar for team A is never returned for team B.
- Redis stopped: the roster endpoint still returns correct data.

## Explain-back questions for the human

1. Why is an in-memory rate limit wrong with two servers or after a restart?
2. How does a version number replace deleting cache keys?
3. Which things must never be cached, and what bug does caching each one cause?
