# ADR-010: Redis Cache-Aside with Versioned Invalidation, Stampede Protection, and Atomic Lua Rate Limiting

**Date:** 2026-10-12  
**Status:** accepted  

## Problem
1. **Database Contention under Read Load**: High-concurrency mobile activity feed polling, roster loading, and calendar queries repeatedly execute identical SQL queries against tenant database shards, risking PostgreSQL connection pool saturation and elevated latency during shift handovers.
2. **Cache Invalidation Complexity & Stale Reads**: When shifts or memberships change, stale cached views must be immediately invalidated across all connected devices without slow, blocking Redis `KEYS` or `SCAN` operations.
3. **Thundering Herd / Cache Stampedes**: Simultaneous cache misses across hundreds of concurrent clients can trigger hundreds of simultaneous identical database queries, overwhelming database connections.
4. **Brute Force & DoS Attacks**: Authentication routes (`/v1/auth/login`, `/v1/auth/register`), invitations, and sensitive endpoints are vulnerable to credential stuffing and automated abuse without strict, atomic rate limits.
5. **Multi-Instance Consistency**: Per-process in-memory caches or rate limiters fail across clustered or multi-container server instances (violating Rule 08).

---

## Options Considered

### 1. In-Memory Process State (Node LRU / Map)
- **Pros:** Zero network roundtrip; trivial local implementation.
- **Cons:** Fails in clustered or multi-instance deployments; memory state disappears on process restart; state desynchronizes between API replicas; strictly forbidden by **Rule 08** ("Redis for rate limits, caches, and locks. Never in-memory objects.").

### 2. Pure Database Scaling Without Caching
- **Pros:** Guarantees absolute freshness on every read; no secondary data store to manage.
- **Cons:** Benchmarks demonstrate database connection pool queueing under 200 concurrent users (median latency > 1,140 ms). Inefficient resource utilization for static or infrequently modified schedules.

### 3. Distributed Redis with Team Version Counters, Stampede Mutex Locks, and Atomic Lua Rate Limiting (Chosen)
- **Cache-Aside Pattern:** Fast Redis reads with automatic database fallback.
- **Team Versioned Keys:** Every tenant has an atomic Redis version integer `teamver:{teamId}`. Keys are formatted as:
  - `feed:{teamId}:v{ver}:{cursor}:{limit}` (TTL: 15s)
  - `cal:{teamId}:v{ver}:{from}:{to}` (TTL: 60s)
  - `roster:{teamId}:v{ver}` (TTL: 300s)
- **Instant O(1) Tenant Invalidation:** Rather than running slow key pattern deletions, write mutations (shift created/updated/deleted, member invited/removed, activity event created) execute `redis.incr("teamver:" + teamId)`. All existing cached entries for that team instantly become unreachable and expire harmlessly via TTL.
- **Stampede Mutex Locking:** Cache misses attempt `redis.set("lock:" + key, "1", "PX", 5000, "NX")`. Only the single lock holder executes the database query; all other concurrent callers wait up to 300ms and read the freshly cached result.
- **Strict "Never Cached" Rule:** Per PRD Section 8 and Rule 08, subscription status, payment status, wallet balances, role and permission checks, and webhook idempotency records are **never** cached.
- **Atomic Lua Rate Limiting:** Fixed-window rate limiting executed via an atomic Lua script executing `INCR` and `EXPIRE`. Returns `allowed`, `remaining`, and `retryAfterSec` in a single roundtrip.
- **Dual Failure Mode:** Sensitive endpoints (auth, billing) **fail-closed (503 Service Unavailable)** if Redis is unavailable, while non-critical read routes **fail-open** with warnings to maintain app availability.

---

## Decision
We adopted **Option 3**. Redis serves as the centralized, multi-instance data store for rate limiting, cache-aside storage, and concurrency locks.

---

## Why
1. **Quantified Performance Gain:** Under k6 load testing with 200 concurrent virtual users and 10,050 records, Redis caching doubled throughput (113 req/s → 232 req/s) and dropped p95 latency by 61.6% (1.90s → 0.73s) with 0% errors.
2. **Deterministic Invalidation:** Atomic version counters eliminate stale-cache bugs without the performance overhead of full Redis keyspace scans.
3. **Resilience Against Abuse:** Proof Test T13 proves that requests exceeding configured thresholds are rejected with HTTP 429 and accurate `Retry-After` headers, and automatically unblock once the window elapses.
4. **Security Isolation:** Strict compliance with Rule 01 and Rule 08 ensures authentication, authorization, and financial ledgers remain 100% server-authoritative and uncached.

---

## Consequences
- Requires Redis (or Redis Memory Server for local development/testing) running on `REDIS_URL`.
- Write operations on shifts, memberships, and activity events must call `bumpTeamVersion(teamId)`.
- Sensitive routes must handle 503 fail-closed gracefully on client devices.
