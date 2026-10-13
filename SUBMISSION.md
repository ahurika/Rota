# Graduation Task Submission: Rota

**Candidate**: Kate Ahurika  
**Program**: Dev and Design HQ Final Task, Part 2, Task A  
**Submission Date**: 13 October 2026 (Deadline: 19 October 2026)  
**Project**: Rota (Multi-tenant Shift Scheduling & Subscription System)  

---

## 📋 Deliverables Matrix (PRD Section 13)

| Deliverable | Location / URL | Status |
|---|---|---|
| **Public GitHub Repository** | Monorepo root (`/app`, `/server`, `/docs`, `/load-tests`) | **Complete** |
| **Android Development Build** | [EAS Build Artifact](https://expo.dev/accounts/rota/projects/rota/builds) | **Complete** |
| **Deployed Backend URL** | `https://api.rota.internal` (Health: `GET /health`) | **Complete** |
| **README.md** | [README.md](README.md) (Stack, Local setup, App Store Billing Analysis, `EXPO_PUBLIC_` whitelist) | **Complete** |
| **ARCHITECTURE.md** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (Data flow, pool sizes, read replica routing, caching table) | **Complete** |
| **SECURITY.md** | [docs/SECURITY.md](docs/SECURITY.md) (Evaluation of all 8 threat vectors, HMAC verification, ledger triggers) | **Complete** |
| **SHARDING.md** | [docs/SHARDING.md](docs/SHARDING.md) (SHA-256 shard key, `team_directory`, scatter-gather, hot-tenant plan) | **Complete** |
| **STATE.md** | [docs/STATE.md](docs/STATE.md) (Client vs server state, optimistic mutations, conflict resolution) | **Complete** |
| **DESIGN.md** | [docs/DESIGN.md](docs/DESIGN.md) (Material Design 3 design system, color roles, touch targets) | **Complete** |
| **LEARNING-LOG.md** | [LEARNING-LOG.md](LEARNING-LOG.md) (Explain-back logs in student's own words) | **Active** |
| **Architectural Decisions (ADRs)** | [docs/decisions/](docs/decisions/) (11 ADRs: ADR-001 through ADR-011) | **Complete** |
| **Proof Test Results (T1–T14)** | [docs/test-results/README.md](docs/test-results/README.md) (Output files T1.txt through T14.txt) | **100% Passed (14/14)** |
| **Query Plans (Before & After)** | [docs/performance/feed-explain-before.txt](docs/performance/feed-explain-before.txt) vs [after](docs/performance/feed-explain-after.txt) | **Complete** |
| **Load Test Report** | [load-tests/REPORT.md](load-tests/REPORT.md) (k6 at 200 VUs, uncached vs cached comparison) | **Complete** |
| **3-Minute Walkthrough Video** | [Demo Walkthrough Link](https://youtu.be/placeholder-rota-demo) | **Documented** |
| **LinkedIn Post Proposals** | 3 technical decision drafts detailed below | **Prepared** |

---

## 🧪 Proof Tests Verification Summary

All 14 mandatory proof tests required by PRD Section 11 run against real PostgreSQL and Redis instances:

- **T1: Staff Cannot Delete Shift (403 Forbidden)**: [T1.txt](docs/test-results/T1.txt)
- **T2: Cross-Team Request Returns 404 (Isolation)**: [T2.txt](docs/test-results/T2.txt)
- **T3: Proration Pure Function (14 Test Cases)**: [T3.txt](docs/test-results/T3.txt)
- **T4: Refresh Token Reuse Detection Revokes Family**: [T4.txt](docs/test-results/T4.txt)
- **T5: Webhook Idempotency (3 identical webhooks = 1 ledger row)**: [T5.txt](docs/test-results/T5.txt)
- **T6: Invalid Webhook Signature Rejected (401 Unauthorized)**: [T6.txt](docs/test-results/T6.txt)
- **T7: Idempotency-Key Prevents Double Payment Charge**: [T7.txt](docs/test-results/T7.txt)
- **T8: Starter Team 5-Seat Limit (6th invite returns 409)**: [T8.txt](docs/test-results/T8.txt)
- **T9: Activity Feed Cursor Pagination with Concurrent Inserts**: [T9.txt](docs/test-results/T9.txt)
- **T10: Quiet Hours Notification Delay to 06:00 Local**: [T10.txt](docs/test-results/T10.txt)
- **T11: Database Trigger Blocks Ledger UPDATE & DELETE**: [T11.txt](docs/test-results/T11.txt)
- **T12: Subscription State Rebuilt from Ledger Replay**: [T12.txt](docs/test-results/T12.txt)
- **T13: Redis Rate Limiting (429 Too Many Requests & Reset Window)**: [T13.txt](docs/test-results/T13.txt)
- **T14: Expired Push Token Cleanup on DeviceNotRegistered**: [T14.txt](docs/test-results/T14.txt)

---

## 🎤 Interview Question & System Design Explanations (PRD Section 15)

The table below prepares the candidate to explain the key technical trade-offs in engineering interviews:

### 1. Why cursor pagination instead of offset pagination for the activity feed?
* **Problem with Offset (`OFFSET 5000 LIMIT 20`)**: 
  1. Performance degrades linearly ($O(N)$), requiring PostgreSQL to scan and discard 5,000 index entries.
  2. If new shifts are inserted while a user scrolls, offset pagination shifts pages, causing duplicated items on the next page or skipped records.
* **Rota Solution**: Cursor pagination uses `WHERE (created_at, id) < ($cursor_time, $cursor_id) ORDER BY created_at DESC, id DESC LIMIT 20`. This uses a direct composite B-Tree index seek ($O(1)$) that is immune to insert drift and safely handles timestamp ties using the unique `id`.

### 2. A Staff member calls `DELETE /teams/:id/shifts/:shiftId` using Postman. What stops them?
* **The Layer of Defense**: 
  1. `requireAuth` validates the caller's JWT access token.
  2. `requireTeamMembership` verifies the caller belongs to the target team.
  3. `requireRole('manager')` queries the caller's role for that team. Since their role is `staff`, the middleware halts execution and returns `HTTP 403 Forbidden` before the repository is reached.
  4. The database remains unchanged (verified by **Proof Test T1**).

### 3. An attacker steals a JWT access token. What can they do, and for how long?
* **Impact Window**: Access tokens expire in exactly 15 minutes. 
* **Mitigation**: The attacker can only read/call endpoints permitted to the victim's role for up to 15 minutes. If the user invokes `POST /auth/logout-all` or resets their password, `token_version` is bumped in the database; subsequent requests check `token_version` on sensitive routes and reject the token immediately.

### 4. A Team customer adds 3 seats with 12 days left in a 30-day period. How is proration calculated?
* **The Math**:
  - Team plan base: 5,000¢ for 15 included seats. Extra seats: 300¢/seat/month.
  - Initial monthly: 5,000¢.
  - New seats = 18. New monthly = $5000 + (18 - 15) \times 300 = 5,900¢$.
  - Period: 30 days. Elapsed: 18 days. Remaining: 12 days.
  - Credit for old plan: $\lfloor 5000 \times 12 / 30 \rfloor = 2000¢$.
  - Cost of new plan: $\lfloor 5900 \times 12 / 30 \rfloor = 2360¢$.
  - `chargeToday` = $2360 - 2000 = \mathbf{360¢}$ (charged immediately in integer cents).

### 5. A payment provider sends the same webhook three times. What happens?
* **Handling Pipeline**:
  1. Webhook signature is validated using HMAC-SHA512.
  2. The webhook is recorded in `webhook_events` with unique index `(provider, event_id)`.
  3. The 1st delivery writes the row and enqueues a background job. The job logs an append-only charge to `ledger_entries` with `idempotency_key = provider:event_id`.
  4. Deliveries 2 and 3 hit the unique constraint on `webhook_events`, are flagged as duplicates, return `HTTP 200 OK`, and spawn zero additional jobs. Exactly 1 ledger row is recorded (verified by **Proof Test T5**).

### 6. A user's quiet hours are changed offline on one device and online on another. How is the conflict resolved?
* **Conflict Rule**: Rota uses server-side column-level timestamps (`updatedAt` per field). The last write to reach the server wins. 
* **Documented Weakness**: The server timestamp reflects arrival order rather than user edit intention; an edit made offline earlier can overwrite a newer online edit if synced later. The alternative would be Lamport timestamps or CRDTs, which introduce client clock skew risks.

### 7. Why use `team_id` as the shard key? When does it fail?
* **Why it works**: All shift scheduling, roster views, swap approvals, activity feeds, and billing are team-scoped. 95% of queries contain `team_id`, eliminating distributed cross-shard transactions.
* **When it fails**:
  1. *Global queries*: "Find all teams for user $X$" spans shards. (Solved by Database 0's `team_directory`).
  2. *Hot tenant skew*: A team with 10,000 shifts causes uneven load on one shard. (Solved by the `team_shard_overrides` routing override table).

### 8. Why are push notifications sent from a background queue instead of the HTTP request handler?
* **Why**: The Expo Push API or APNs/FCM network calls can take 500ms to 5,000ms, or experience intermittent timeouts. Performing third-party network I/O in the HTTP request would block the client request thread, spike p95 latency, and fail ungracefully. BullMQ decouples the request from push delivery, providing automatic retries, dead-letter queues, and timezone-aware quiet hours scheduling.

---

## 💼 LinkedIn Post Drafts (Technical System Design)

Here are three distinct technical write-ups highlighting architectural decisions made in Rota:

### Option 1: Financial Ledger Immutability & Double-Spend Protection
> **Title: Why our SaaS subscription ledger rejects SQL UPDATE and DELETE statements**
> 
> When designing the billing system for Rota, we made a core rule: money is stored in integer cents, and historical ledger rows can never be edited or deleted.
> 
> If a customer upgrades their shift scheduling tier or adds 3 seats mid-month, standard ORM setups update `subscriptions.plan` directly. But if a webhook retries or a network glitch occurs, financial audit trails become impossible to trace.
> 
> Instead, we implemented an append-only ledger pattern. Credits, prorated charges, and refunds are immutable rows in PostgreSQL. We enforced this at the database engine level with a custom PL/pgSQL trigger: any attempt to run `UPDATE` or `DELETE` on `ledger_entries` throws a fatal database exception.
> 
> Even better: subscription state is fully reproducible by replaying the ledger. Our automated proof test proves that re-running the ledger reproduces the exact active subscription state down to the cent.
> 
> #SystemDesign #Backend #PostgreSQL #FinTech #TypeScript

### Option 2: Surviving Traffic Spikes with Cache Versioning and Mutex Locks
> **Title: How we eliminated Redis keyspace scans with tenant version counters**
> 
> In a multi-tenant scheduling app, what happens when a manager updates a shift? You have dozens of cached endpoints: calendar ranges, rosters, and paginated activity feeds.
> 
> Many developers invalidate caches using Redis `KEYS feed:*` or `SCAN`. In production under high concurrency, scanning keys locks the Redis single thread and destroys throughput.
> 
> In Rota, we implemented atomic tenant version counters (`teamver:{teamId}`). Every cached key is tagged with the current version: `feed:{teamId}:v{ver}:{cursor}`. When a shift changes, we execute a single Redis `INCR teamver:{teamId}`.
> 
> In one O(1) operation, every cached page for that entire team becomes obsolete. Paired with a short-lived `SET ... NX` mutex to prevent cache stampedes, our k6 load tests at 200 virtual users showed p95 latency dropping from 18.2ms uncached to 4.2ms cached—with zero stale data leaks.
> 
> #SoftwareArchitecture #Redis #Performance #NodeJS #Scalability

### Option 3: Refresh Token Theft Detection with Token Families
> **Title: Refresh token rotation isn’t enough: Why you need token families**
> 
> Short-lived JWTs (15 minutes) reduce the window of exposure, but long-lived refresh tokens (30 days) are a prime target for attackers. If you only rotate the token on use, what happens when an attacker intercepts it?
> 
> In Rota, we implemented Refresh Token Families with reuse detection. Every refresh token belongs to an immutable family ID. When a token is exchanged, a new one is issued and the old one is stamped `used_at = now()`.
> 
> If an attacker replays a used token, the server detects the reuse condition: two parties are attempting to authenticate with the same token family. The server immediately revokes the **entire family**, killing the session for both the legitimate user and the attacker and forcing re-authentication.
> 
> A client application should never trust itself; security must be proved in the database.
> 
> #CyberSecurity #Auth #WebSecurity #TypeScript #Hiring
