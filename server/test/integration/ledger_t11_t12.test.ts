import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { app } from '../../src/app.js';
import { dbForTeam } from '../../src/db/shards.js';
import { ledgerRepository } from '../../src/repositories/ledgerRepository.js';
import { billingService } from '../../src/services/billing/billingService.js';
import { subscriptionsRepository } from '../../src/repositories/subscriptionsRepository.js';

describe('Proof Tests T11 & T12: Ledger Immutability and State Reconstruction', () => {
  it('Proof Test T11: UPDATE, DELETE, and TRUNCATE on ledger_entries fail via DB trigger', async () => {
    const timestamp = Date.now();
    const ownerEmail = `owner_t11_${timestamp}@example.com`;
    const password = 'Password123!Secure';

    // 1. Create Owner and Team
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
      body: JSON.stringify({ name: 'T11 Ledger Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    const pool = await dbForTeam(teamId);

    // 2. Insert valid ledger entry
    const entry = await ledgerRepository.insertEntry(teamId, {
      type: 'charge',
      amountCents: 5000,
      currency: 'USD',
      plan: 'team',
      seats: 15,
      reason: 'initial_plan_charge',
      idempotencyKey: `idemp_${crypto.randomUUID()}`,
    });
    expect(entry.id).toBeDefined();

    // 3. Attempt direct SQL UPDATE on the ledger entry -> MUST FAIL
    await expect(
      pool.query(`UPDATE ledger_entries SET amount_cents = 1000 WHERE id = $1`, [entry.id])
    ).rejects.toThrow(/append-only/i);

    // 4. Attempt direct SQL DELETE on the ledger entry -> MUST FAIL
    await expect(
      pool.query(`DELETE FROM ledger_entries WHERE id = $1`, [entry.id])
    ).rejects.toThrow(/append-only/i);

    // 5. Attempt direct SQL TRUNCATE on ledger_entries -> MUST FAIL
    await expect(
      pool.query(`TRUNCATE ledger_entries`)
    ).rejects.toThrow(/append-only/i);

    // 6. Verify row remains completely intact and unmodified
    const checkRes = await pool.query(
      `SELECT * FROM ledger_entries WHERE id = $1`,
      [entry.id]
    );
    expect(checkRes.rows.length).toBe(1);
    expect(checkRes.rows[0].amount_cents).toBe(5000);
  });

  it('Proof Test T12: Subscription state rebuilds from the append-only ledger matching DB state', async () => {
    const timestamp = Date.now();
    const ownerEmail = `owner_t12_${timestamp}@example.com`;
    const password = 'Password123!Secure';

    // 1. Create Owner and Team
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
      body: JSON.stringify({ name: 'T12 Rebuild Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      // 2. Simulate historical billing lifecycle via ledger entries
      // Event 1: Upgrade to Team (15 seats)
      await ledgerRepository.insertEntry(
        teamId,
        {
          type: 'charge',
          amountCents: 5000,
          currency: 'USD',
          plan: 'team',
          seats: 15,
          reason: 'upgrade_to_team',
          idempotencyKey: `charge_${crypto.randomUUID()}`,
        },
        client
      );
      await subscriptionsRepository.updatePlanAndSeats(teamId, 'team', 15, client);

      // Event 2: Add 5 seats to Team (20 seats)
      await ledgerRepository.insertEntry(
        teamId,
        {
          type: 'charge',
          amountCents: 1500,
          currency: 'USD',
          plan: 'team',
          seats: 20,
          reason: 'add_5_seats',
          idempotencyKey: `charge_${crypto.randomUUID()}`,
        },
        client
      );
      await subscriptionsRepository.updatePlanAndSeats(teamId, 'team', 20, client);

      // Event 3: Upgrade to Business (40 seats)
      await ledgerRepository.insertEntry(
        teamId,
        {
          type: 'charge',
          amountCents: 7000,
          currency: 'USD',
          plan: 'business',
          seats: 40,
          reason: 'upgrade_to_business',
          idempotencyKey: `charge_${crypto.randomUUID()}`,
        },
        client
      );
      await subscriptionsRepository.updatePlanAndSeats(teamId, 'business', 40, client);
    } finally {
      client.release();
    }

    // 3. Rebuild subscription state by replaying ledger entries
    const rebuilt = await billingService.rebuildSubscriptionFromLedger(teamId);

    // 4. Load stored subscription state directly from PostgreSQL
    const stored = await subscriptionsRepository.findByTeamId(teamId);
    expect(stored).not.toBeNull();

    // 5. Assert 100% equivalence between rebuilt ledger state and current subscription row
    expect(rebuilt.plan).toBe(stored!.plan);
    expect(rebuilt.seats).toBe(stored!.seats);
    expect(rebuilt.status).toBe(stored!.status);

    expect(rebuilt).toEqual({
      teamId,
      plan: 'business',
      seats: 40,
      status: 'active',
    });
  });
});
