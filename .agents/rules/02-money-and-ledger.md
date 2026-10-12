---
trigger: glob
globs: `server/src/services/billing/**`, `server/src/routes/billing*`, `server/src/routes/webhooks*`, `server/src/jobs/**`.
---

# Rule 02: Money, billing, and the ledger

**Activation:** Glob `server/src/services/billing/**`, `server/src/routes/billing*`, `server/src/routes/webhooks*`, `server/src/jobs/**`. Also set to Model Decision so it loads for any billing question.

## Money representation

1. Store and calculate money as integer minor units (cents). Column type `integer` or `bigint`. Never `float`, `double`, or `numeric` with decimals for balances.
2. JavaScript: `0.1 + 0.2 = 0.30000000000000004`. Decimals drift. Integers do not.
3. Every amount is stored with a `currency` code. Default is `USD`. See `PRD.md` OQ1 for the provider currency issue.
4. Format cents as dollars only at the very edge (UI display). Never parse display strings back into money.
5. Prices live in one file: `server/src/config/plans.ts`. No price literals anywhere else.

## Plans (exact, in cents)

| Plan | Price | Included seats | Extra seat | Cap |
|---|---|---|---|---|
| Starter | 2000 | 5 | not available | 5 |
| Team | 5000 | 15 | 300 | 30 |
| Business | 12000 | 40 | 200 | 100 |

## Proration

1. Proration is a pure function in `services/billing/proration.ts`. No database, no network, no `Date.now()` inside (pass time in).
2. Never use the payment provider's proration or subscription calculator.
3. Rounding: floor each part separately, then subtract. Document this in `docs/ARCHITECTURE.md`.
4. See skill `proration-engine` for the formula and the 14 test cases.

## Who decides success

1. The app never decides whether a payment succeeded.
2. The server decides only from a **verified webhook** (signature checked on the raw body) or from a server-side verify call to the provider for the same reference.
3. When the webhook arrives, compare the amount and currency to the stored `payment_attempts` row. If they differ, do not credit the account. Log and alert.
4. The app shows "processing" until the server billing status changes.

## Idempotency

1. Every endpoint that starts a payment or changes billing requires an `Idempotency-Key` header (UUID).
2. Store the key, a hash of the request, and the response. A repeated key with the same request returns the stored response. A repeated key with a different request returns 422.
3. Webhooks: store `(provider, event_id)` with a unique constraint. If the insert conflicts, return 200 and do nothing else.
4. Ledger rows carry their own unique `idempotency_key`, so even a job that runs twice cannot write two charges.

## Ledger (append-only)

1. Every charge, credit, refund, and adjustment is one row in `ledger_entries`.
2. Never `UPDATE` or `DELETE` ledger rows. A database trigger blocks both. Do not remove the trigger.
3. A mistake is fixed with a new `adjustment` row that references the original.
4. Subscription state (`subscriptions` table) is a convenience. It must be rebuildable from the ledger plus plan config. Keep a function `rebuildSubscriptionFromLedger(teamId)` and a test (T12).
5. Ledger writes and subscription state changes happen in one database transaction.

## Webhooks

1. Route reads the **raw** body (not parsed JSON) to verify the signature.
2. Verify the signature using the provider's current documented method. Paystack signs the raw body with HMAC SHA-512 using the secret key. For Flutterwave or any other provider, read the current docs before coding. Use a constant-time comparison.
3. On bad signature: return 401, write nothing.
4. On good signature: insert the event row (idempotent), enqueue a job, return 200 immediately.
5. The job does the real work, inside a transaction, and marks the event `processed`. Retries use exponential backoff. After 5 attempts the event moves to the failed list.
6. Out-of-order and late webhooks are normal. A webhook that arrives 20 minutes late must still be handled correctly. Handlers check current state before acting.

## Failed renewals

1. On failure: status `past_due`, set `grace_ends_at = now + 7 days`, enqueue owner notifications at day 0, 3, 6.
2. After grace: status `restricted` (see `PRD.md` A7). Owner can still pay.
3. On payment: write a ledger charge, set `active`, clear grace.

## Never

- Never store card numbers, CVV, or full PAN. The provider's hosted checkout handles cards.
- Never cache subscription status, payment status, balances, or idempotency records.
- Never edit a ledger row, even in a test (tests insert new rows).
- Never accept an amount from the client.
- Never log full webhook payloads containing personal data. Log event id, type, and result.

## Proof tests

T3 (proration cases), T5 (duplicate webhooks), T6 (bad signature), T7 (idempotency key), T11 (ledger immutability), T12 (rebuild from ledger). Save output in `docs/test-results/`.
