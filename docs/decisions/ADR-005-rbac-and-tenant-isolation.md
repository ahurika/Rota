# ADR-005: Server-Side RBAC, Multi-Tenant Isolation, and Concurrency-Safe Seat Caps
Date: 2026-10-12   Status: accepted

## Problem
In a multi-tenant B2B scheduling system:
1. One team must never see, modify, or infer the existence of another team's resources (shifts, members, subscriptions).
2. Users within a team have distinct roles (`owner`, `manager`, `staff`), each restricted to specific operations. For example, staff must never delete shifts.
3. Teams on the Starter tier are capped at 5 seats. Concurrent invite generation or invite acceptances must never slip past the 5-seat cap under race conditions.

## Options considered
1. **Client-Side Authorization + Generic ID Lookups**:
   - Pros: Simple backend queries (`SELECT * FROM shifts WHERE id = $1`).
   - Cons: Violates Rule 01 (Zero Client Trust). Vulnerable to Insecure Direct Object References (IDOR).
2. **Returning 403 Forbidden on Cross-Tenant Access**:
   - Pros: Clear that permission is denied.
   - Cons: Leaks resource existence. An attacker probing random UUIDs can confirm whether a shift or team ID exists in the system.
3. **Strict Zero-Trust RBAC with 404 Masking, Team ID-Scoped Queries, and Row-Level Subscription Locks**:
   - Pros:
     - Cross-tenant requests return **404 NOT_FOUND** (not 403), preventing resource existence enumeration.
     - Within a team, unpermitted actions return **403 FORBIDDEN**.
     - All queries take `teamId` in the `WHERE` clause (`WHERE id = $1 AND team_id = $2`), ensuring resources are isolated on the team's designated database shard.
     - Seat caps (5 on Starter) are enforced within transactions using `SELECT * FROM subscriptions WHERE team_id = $1 FOR UPDATE`, serializing concurrent invite generation.
   - Cons: Requires consistent parameterization across all repository calls and explicit middleware pipelines.

## Decision
We implemented strict zero-trust authorization in Hono via:
1. `loadMembership`: Reads the caller's active role from the team's shard on every request (never cached). Returns 404 if the user is not in the team.
2. `requirePermission`: Verifies the active role against the centralized permission matrix in `config/permissions.ts`. Returns 403 if unauthorized.
3. Repository functions strictly require `teamId` in queries.
4. `teamsService.inviteMember` and `acceptInvite` acquire a row-level lock on `subscriptions` (`FOR UPDATE`) to serialize seat checks.

## Why
1. Satisfies PRD Section 6 (Rule 01: Zero Client Trust), FR-T1 through FR-T6, and Proof Tests T1, T2, and T8.
2. Prevents IDOR and enumeration attacks across teams.
3. Concurrency safety verified under simultaneous `Promise.all` requests: exactly one 5th-seat invite succeeds (201) and subsequent invites fail with 409 `SEAT_LIMIT_REACHED`.

## Consequences
- Every route operating on a team resource must include `/:teamId` in its path and execute `loadMembership()` and `requirePermission()`.
- Client apps must never send roles in request bodies; role authority originates exclusively from database records.
