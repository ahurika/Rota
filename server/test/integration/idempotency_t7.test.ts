import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { app } from '../../src/app.js';
import { dbForTeam } from '../../src/db/shards.js';

describe('Proof Test T7: Idempotency Key Middleware Enforcement', () => {
  it('T7: Same Idempotency-Key returns stored response; changed body returns 422 conflict', async () => {
    const timestamp = Date.now();
    const ownerEmail = `owner_t7_${timestamp}@example.com`;
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
      body: JSON.stringify({ name: 'T7 Idempotency Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    const idempotencyKey = crypto.randomUUID();
    const payloadA = { plan: 'team', seats: 15 };

    // 2. First call with Idempotency-Key
    const firstRes = await app.request(`/v1/teams/${teamId}/billing/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payloadA),
    });

    expect(firstRes.status).toBe(200);
    const firstData = await firstRes.json();

    // 3. Second call with SAME Idempotency-Key and SAME body
    const secondRes = await app.request(`/v1/teams/${teamId}/billing/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payloadA),
    });

    expect(secondRes.status).toBe(200);
    const secondData = await secondRes.json();
    expect(secondData).toEqual(firstData);

    // Verify only ONE payment attempt was written to the database
    const pool = await dbForTeam(teamId);
    const attempts = await pool.query(
      `SELECT * FROM payment_attempts WHERE team_id = $1 AND idempotency_key = $2`,
      [teamId, idempotencyKey]
    );
    expect(attempts.rows.length).toBe(1);

    // 4. Third call with SAME Idempotency-Key but DIFFERENT body -> 422 IDEMPOTENCY_CONFLICT
    const payloadB = { plan: 'business', seats: 40 };
    const conflictRes = await app.request(`/v1/teams/${teamId}/billing/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payloadB),
    });

    expect(conflictRes.status).toBe(422);
    const conflictData = (await conflictRes.json()) as any;
    expect(conflictData.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});
