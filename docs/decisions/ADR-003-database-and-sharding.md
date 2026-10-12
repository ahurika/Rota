# ADR-003: Two-Database Sharding Simulation and Data Placement
Date: 2026-10-12   Status: accepted

## Problem
Rota is designed to demonstrate high-scale backend system design patterns (Part 2, Task A). Multi-tenant teams can generate substantial write volume (shifts, activity events, ledger entries). We needed a data placement strategy that scales horizontally without requiring distributed transactions for every single query.

## Options considered
1. **Single Monolithic Database**:
   - Pros: Simple ACID transactions across all tables, simpler foreign keys.
   - Cons: Does not satisfy the system design requirements of Task A; single point of write bottleneck.
2. **Database-per-tenant**:
   - Pros: Total isolation.
   - Cons: Massive connection overhead per tenant, slow migrations across thousands of databases, infeasible on cloud free-tiers.
3. **Horizontal Sharding by `team_id` Hash across Two Shards with Global Database 0**:
   - Pros: Simulates production horizontal sharding realistically; tenant-scoped queries hit exactly one shard; predictable routing via `hashShard(teamId) = sha256(teamId)[0..4] % 2`.
   - Cons: Cross-shard joins are impossible; global tables (users, refresh tokens, team directory) must live on database 0.

## Decision
We chose the horizontal sharding simulation with `team_id` as the shard key across two PostgreSQL databases (`shard 0` and `shard 1`), while storing global authentication and directory tables in database 0.

## Why
1. Almost all core business queries in Rota are naturally scoped to a specific team (shifts, swaps, roster, activity feed, billing).
2. The hash formula is deterministic and stable: `hashShard(teamId)` produces identical results across all API instances.
3. An override table (`team_shard_overrides`) enables hot-shard mitigation for unusually large enterprise teams.

## Consequences
- All team repository methods must accept `teamId` and route through `db.forTeam(teamId)`.
- Global tables live in database 0, which carries slightly higher baseline load (documented as a known trade-off in `SHARDING.md`).
- Cross-team queries (such as listing all teams for a user) query `team_directory` on database 0 rather than querying both shards.
