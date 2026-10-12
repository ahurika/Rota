# ADR-008: Payment Provider Integration, Proration Engine, and Append-Only Financial Ledger
Date: 2026-10-12   Status: accepted

## Problem
Rota charges teams a monthly per-seat subscription price. Teams dynamically add/remove seats or upgrade/downgrade tiers in the middle of a billing period. We need:
1. Deterministic, fair proration calculations that eliminate floating-point drift.
2. Complete server authority over pricing (zero trust in mobile client numbers).
3. Webhook idempotency to handle provider network retries without double-charging.
4. Tamper-proof, append-only financial audit trails that survive state corruption.

## Options considered
1. **Third-Party Provider Managed Subscriptions (Stripe / Paystack Billing API)**:
   - Pros: Provider calculates proration automatically.
   - Cons: Provider APIs differ in rounding and timezone handling; vendor lock-in; testing proration offline is difficult; violates Rule 02 requirement to understand and own all money math.
2. **Floats and Decimals in Database (`NUMERIC(10,2)` or JS `number`)**:
   - Pros: Familiar dollar representation.
   - Cons: Binary floating point drift (`0.1 + 0.2 = 0.30000000000000004`); rounding discrepancies accumulate over thousands of team seat changes.
3. **Internal Server-Side Pure Proration Engine + Append-Only Triggered Ledger (Chosen)**:
   - **Integer Cents**: All money is represented strictly as integer minor units (cents) with an explicit currency code (`USD`).
   - **Pure Proration Math**: Implemented as a pure function `prorateChange` taking immutable inputs (`oldPlan`, `oldSeats`, `newPlan`, `newSeats`, `periodStart`, `periodDays`, `now`).
   - **Rounding Rule**: Floor unused credit and new cost separately (`Math.floor(cost) - Math.floor(credit)`), then subtract.
   - **Direction Rule**: Upgrades charged immediately (`chargeCents > 0`); downgrades scheduled for renewal (`chargeCents = 0`).
   - **Append-Only Ledger**: Database triggers (`trigger_block_ledger_mutation` and `trigger_block_ledger_truncate`) strictly raise exceptions on any SQL `UPDATE`, `DELETE`, or `TRUNCATE`.
   - **Webhook Security**: Cryptographic HMAC SHA-512 constant-time verification (`crypto.timingSafeEqual`) on the raw request body before JSON parsing. Unique constraint on `(provider, event_id)` absorbs retried events safely with 200 OK.
   - **Idempotency**: `Idempotency-Key` header with canonical SHA-256 request hashing enforces that retrying with the same payload returns the cached result, while conflicting payloads return 422.

## Decision
We adopted Option 3: an internal pure proration engine, integer-cent money model, Paystack webhook integration with HMAC SHA-512 verification, and an append-only PostgreSQL ledger.

## Why
1. **Zero Drift**: Integer cents guarantee bit-for-bit exact financial computations.
2. **Auditability & Disaster Recovery**: Subscriptions can be deterministically rebuilt from the ledger at any time (`rebuildSubscriptionFromLedger(teamId)` passed Proof Test T12).
3. **Attack Resistance**: Eliminates race conditions, duplicate webhooks (Proof Test T5), bad signatures (Proof Test T6), and payload tampering (Proof Test T7).
4. **Trigger Protection**: Database-level triggers ensure even rogue SQL updates cannot alter historical charges (Proof Test T11).

## Consequences
- No price literals may exist outside `server/src/config/plans.ts`.
- Ledger rows can never be modified; corrections must be inserted as new `refund` or `adjustment` entries.
- Provider webhooks must be verified using raw request body strings before JSON parsing.
