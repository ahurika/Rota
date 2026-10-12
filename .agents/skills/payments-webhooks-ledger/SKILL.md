---
name: payments-webhooks-ledger
description: Use when building Rota checkout, payment attempts, idempotency keys, webhook verification and processing, the append-only ledger, rebuilding subscription state, or failed renewal handling. Covers Paystack or Flutterwave in test mode and the proof tests T5, T6, T7, T11, T12.
---

# Payments, webhooks, and the ledger

## Golden rule

The app never decides whether a payment succeeded. Only the server decides, and only after a verified webhook (or a server-side verify call). The app opens a hosted checkout and then asks the server for status.

## Before coding: check the provider (do this first, in milestone M5)

Read the current official docs for the provider you chose. Answer these and write an ADR (`ADR-005-payment-provider`):

1. Does test mode accept **USD**? If not, see `PRD.md` OQ1: keep the ledger in USD cents, charge in NGN with a fixed documented rate stored per payment attempt.
2. How is the webhook signed, and which header carries it? (Paystack: HMAC SHA-512 of the raw body with your secret key in the `x-paystack-signature` header. Confirm in current docs. Flutterwave: use its current documented method.)
3. Can you charge a saved authorization for renewals in test mode? If not, renewals create a hosted checkout link and notify the owner (`PRD.md` OQ2).
4. Which fields identify an event uniquely? Use that as `event_id`. If the provider sends no event id, build one from event type plus transaction reference plus status, and document it.

## Tables

```
payment_attempts(id, team_id, kind, amount_cents, currency, idempotency_key unique,
                 provider_ref unique, status, requested_plan, requested_seats, created_at)
webhook_events(id, provider, event_id, payload jsonb, status, received_at, processed_at,
               unique(provider, event_id))
ledger_entries(id, team_id, type, amount_cents, currency, plan, seats, reason,
               idempotency_key unique, provider_ref, created_at)
idempotency_keys(user_id, key, request_hash, status, response jsonb, created_at,
                 primary key(user_id, key))
```

`type` is `charge`, `credit`, `refund`, or `adjustment`. Amounts are integers. Charges are positive, credits and refunds are stored as their own types (decide a sign convention, write it in `ARCHITECTURE.md`, and keep it).

## Ledger immutability (T11)

```sql
CREATE FUNCTION ledger_no_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_no_mutation();
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_no_mutation();
```

Add `BEFORE TRUNCATE` protection too (statement-level trigger). Test: `UPDATE` and `DELETE` on a ledger row both fail.

## Idempotency middleware (T7)

For `POST .../billing/change` and `POST .../billing/checkout`:

```
key = header Idempotency-Key (UUID, required) else 400
hash = sha256(method + path + canonical body)
INSERT INTO idempotency_keys(user_id, key, request_hash, status) VALUES (..., 'in_progress')
  ON CONFLICT DO NOTHING
if inserted: run handler, then UPDATE status='done', response=<json>
else load row:
   row.request_hash != hash        -> 422 IDEMPOTENCY_CONFLICT
   row.status = 'done'             -> return stored response (same status code and body)
   row.status = 'in_progress'      -> 409 REQUEST_IN_PROGRESS (client retries shortly)
```

The app generates the UUID once per payment attempt and reuses it on retries. A new attempt gets a new key.

## Checkout creation

1. Compute amount on the server (see `proration-engine`). Never read an amount from the body.
2. Insert `payment_attempts` with `status='pending'`, the idempotency key, and the plan and seats being bought.
3. Call the provider to initialise a hosted checkout, passing your `payment_attempts.id` as the reference. Store `provider_ref`.
4. Return `{ checkoutUrl, attemptId }`. The app opens `checkoutUrl` in the browser.

## Webhook endpoint (T5, T6)

```
POST /v1/webhooks/:provider
1. raw = await c.req.raw.text()            // RAW body, before any JSON parsing
2. verify signature with constant-time compare. fail -> 401, write nothing, log warn
3. event = JSON.parse(raw); eventId = <provider event id>
4. INSERT INTO webhook_events(provider, event_id, payload, status)
     VALUES (...,'received') ON CONFLICT (provider, event_id) DO NOTHING RETURNING id
5. if inserted: enqueue job 'process-webhook' { webhookEventId, requestId }
6. return 200 immediately (also 200 for duplicates)
```

Handler stays fast. Provider timeouts cause provider retries, which create duplicates, which the unique constraint absorbs.

## Webhook job

```
process-webhook(webhookEventId):
  load event; if status = 'processed' -> return (idempotent)
  BEGIN
    attempt = SELECT ... FROM payment_attempts WHERE provider_ref = $ref FOR UPDATE
    if not found -> mark event 'ignored', log, COMMIT, return
    if attempt.status = 'succeeded' -> mark event processed, COMMIT, return
    if event says success:
        verify amount and currency equal attempt.amount_cents and attempt.currency
          (mismatch -> mark attempt 'amount_mismatch', alert, do not credit)
        INSERT ledger charge  (idempotency_key = 'attempt:' || attempt.id)  // unique
        apply plan and seats to subscriptions, set status 'active', clear grace_ends_at
        UPDATE payment_attempts SET status='succeeded'
        INSERT activity event, enqueue owner notification
    else if failure: UPDATE attempt status 'failed'; if renewal, run failed-renewal logic
    UPDATE webhook_events SET status='processed', processed_at=now()
  COMMIT
```

Late webhook (20 minutes after the user left the screen) is fine: nothing in this flow depends on timing. If a seat hold or cart existed, it is not part of Rota. Test it: process an event long after the attempt was created.

## Rebuilding state from the ledger (T12)

Write `rebuildSubscriptionFromLedger(teamId)`: replay ledger rows in order using the plan and seats on each charge or adjustment row to reconstruct current plan, seats, and last paid period. A test creates activity through the normal flow, rebuilds, and asserts equality with the `subscriptions` row. If they differ, the ledger is missing information: add the missing fields to ledger rows (plan, seats, period start) rather than loosening the test.

## Failed renewal

1. Renewal job creates a payment attempt of kind `renewal` for `monthly(plan, seats)` (use saved authorization if available, otherwise a hosted checkout link emailed and pushed to the owner).
2. On failure or no payment by the due time: `status='past_due'`, `grace_ends_at = now + 7 days`, enqueue owner notifications at day 0, 3, 6 (type `billing`).
3. Daily job: if `now > grace_ends_at` and unpaid, `status='restricted'` (see `PRD.md` A7).
4. Any later success lifts it.

## Refunds

Refunds are new ledger rows of type `refund` referencing the original charge. Never edit the original.

## Tests

- **T5:** send the same signed event 3 times (simultaneously and sequentially). Exactly one ledger row, one subscription change, one `processed` event.
- **T6:** valid payload with a wrong signature returns 401 and no rows are written. Test a missing header too.
- **T7:** call change with the same key and body twice: identical response, one attempt, one ledger row. Same key with a different body returns 422.
- **T11:** UPDATE and DELETE on a ledger row both raise.
- **T12:** rebuild equals stored state.
- Amount mismatch webhook does not credit.
- Webhook arrives with no matching attempt: ignored, 200.

## Never

- Never trust a redirect URL or an app message as proof of payment.
- Never parse the body as JSON before verifying the signature.
- Never log secrets, signatures, or full payloads.
- Never cache payment or subscription status.

## Explain-back questions for the human

1. Why return 200 for a duplicate webhook instead of an error?
2. Which two database constraints stop a double charge, and what does each catch?
3. Why can the subscription state be rebuilt from the ledger, and why does that matter?
