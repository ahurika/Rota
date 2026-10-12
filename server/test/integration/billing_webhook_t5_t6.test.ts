import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { app } from '../../src/app.js';
import { dbForTeam, primaryPool0 } from '../../src/db/shards.js';
import { paymentProvider } from '../../src/services/billing/paymentProvider.js';

describe('Proof Tests T5 & T6: Webhook Signature Verification and Idempotency', () => {
  const secretKey = 'test_webhook_secret_key_12345';
  beforeAll(() => {
    paymentProvider.setSecretKey(secretKey);
  });

  const signPayload = (payloadString: string): string => {
    return crypto.createHmac('sha512', secretKey).update(payloadString).digest('hex');
  };

  it('Proof Test T6: Bad or missing signature returns 401 and writes nothing to the database', async () => {
    const rawPayload = JSON.stringify({
      event: 'charge.success',
      id: 999901,
      data: { reference: 'att_nonexistent_ref', amount: 5000, currency: 'USD' },
    });

    // 1. Missing signature header
    const noSigRes = await app.request('/v1/webhooks/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawPayload,
    });
    expect(noSigRes.status).toBe(401);

    // 2. Tampered / invalid signature
    const badSigRes = await app.request('/v1/webhooks/paystack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      body: rawPayload,
    });
    expect(badSigRes.status).toBe(401);

    // 3. Verify nothing written to webhook_events
    const checkRes = await primaryPool0.query(
      `SELECT * FROM webhook_events WHERE event_id = '999901'`
    );
    expect(checkRes.rows.length).toBe(0);
  });

  it('Proof Test T5: Same signed webhook received 3 times creates exactly one ledger row and one subscription change', async () => {
    const timestamp = Date.now();
    const ownerEmail = `owner_t5_${timestamp}@example.com`;
    const password = 'Password123!Secure';

    // 1. Register Owner and Create Team
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken } = (await regRes.json()) as any;

    const teamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: 'T5 Webhook Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    // 2. Initiate subscription upgrade to Team (15 seats) via change endpoint
    const idempotencyKey = crypto.randomUUID();
    const changeRes = await app.request(`/v1/teams/${teamId}/billing/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ plan: 'team', seats: 15 }),
    });

    expect(changeRes.status).toBe(200);
    const changeData = (await changeRes.json()) as any;
    expect(changeData.status).toBe('payment_required');
    const providerRef = changeData.providerRef;
    expect(providerRef).toBeDefined();

    // 3. Craft realistic Paystack webhook payload
    const eventId = `evt_t5_${timestamp}`;
    const webhookPayload = JSON.stringify({
      event: 'charge.success',
      id: eventId,
      data: {
        reference: providerRef,
        amount: changeData.chargeCents,
        currency: 'USD',
        status: 'success',
      },
    });

    const signature = signPayload(webhookPayload);

    // 4. Send the same webhook 3 times concurrently
    const [res1, res2, res3] = await Promise.all([
      app.request('/v1/webhooks/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
        body: webhookPayload,
      }),
      app.request('/v1/webhooks/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
        body: webhookPayload,
      }),
      app.request('/v1/webhooks/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
        body: webhookPayload,
      }),
    ]);

    // All three requests MUST return 200 OK (Rule 02)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    // 5. Query the database to verify strict idempotency
    const pool = await dbForTeam(teamId);

    // Exactly ONE ledger row exists
    const ledgerCheck = await pool.query(
      `SELECT * FROM ledger_entries WHERE team_id = $1 AND provider_ref = $2`,
      [teamId, providerRef]
    );
    expect(ledgerCheck.rows.length).toBe(1);
    expect(ledgerCheck.rows[0].type).toBe('charge');
    expect(ledgerCheck.rows[0].plan).toBe('team');
    expect(ledgerCheck.rows[0].seats).toBe(15);
    expect(ledgerCheck.rows[0].amount_cents).toBe(changeData.chargeCents);

    // Subscription status updated to active with plan 'team' and 15 seats
    const subCheck = await pool.query(
      `SELECT * FROM subscriptions WHERE team_id = $1`,
      [teamId]
    );
    expect(subCheck.rows[0].plan).toBe('team');
    expect(subCheck.rows[0].seats).toBe(15);
    expect(subCheck.rows[0].status).toBe('active');

    // Payment attempt status updated to succeeded
    const attemptCheck = await pool.query(
      `SELECT * FROM payment_attempts WHERE provider_ref = $1`,
      [providerRef]
    );
    expect(attemptCheck.rows[0].status).toBe('succeeded');
  });
});
