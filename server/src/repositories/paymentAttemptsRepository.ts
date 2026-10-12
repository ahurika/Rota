import pg from 'pg';
import { dbForTeam } from '../db/shards.js';

export interface PaymentAttemptRow {
  id: string;
  team_id: string;
  kind: string; // 'checkout' | 'change' | 'renewal'
  amount_cents: number;
  currency: string;
  idempotency_key: string;
  provider_ref: string | null;
  status: string; // 'pending' | 'succeeded' | 'failed' | 'amount_mismatch'
  requested_plan: string | null;
  requested_seats: number | null;
  created_at: Date;
}

export class PaymentAttemptsRepository {
  public async create(
    teamId: string,
    data: {
      kind: string;
      amountCents: number;
      currency?: string;
      idempotencyKey: string;
      providerRef?: string | null;
      status?: string;
      requestedPlan?: string | null;
      requestedSeats?: number | null;
    },
    client?: pg.PoolClient
  ): Promise<PaymentAttemptRow> {
    const query = `
      INSERT INTO payment_attempts (
        team_id, kind, amount_cents, currency, idempotency_key, provider_ref, status, requested_plan, requested_seats
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const params = [
      teamId,
      data.kind,
      data.amountCents,
      data.currency || 'USD',
      data.idempotencyKey,
      data.providerRef || null,
      data.status || 'pending',
      data.requestedPlan || null,
      data.requestedSeats || null,
    ];

    if (client) {
      const res = await client.query<PaymentAttemptRow>(query, params);
      return res.rows[0];
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<PaymentAttemptRow>(query, params);
    return res.rows[0];
  }

  public async findByProviderRef(
    teamId: string,
    providerRef: string,
    client?: pg.PoolClient
  ): Promise<PaymentAttemptRow | null> {
    const query = `SELECT * FROM payment_attempts WHERE provider_ref = $1 LIMIT 1`;
    if (client) {
      const res = await client.query<PaymentAttemptRow>(query, [providerRef]);
      return res.rows[0] || null;
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<PaymentAttemptRow>(query, [providerRef]);
    return res.rows[0] || null;
  }

  public async lockByProviderRef(
    providerRef: string,
    client: pg.PoolClient
  ): Promise<PaymentAttemptRow | null> {
    const res = await client.query<PaymentAttemptRow>(
      `SELECT * FROM payment_attempts WHERE provider_ref = $1 FOR UPDATE`,
      [providerRef]
    );
    return res.rows[0] || null;
  }

  public async updateStatus(
    id: string,
    status: string,
    client: pg.PoolClient
  ): Promise<PaymentAttemptRow> {
    const res = await client.query<PaymentAttemptRow>(
      `UPDATE payment_attempts SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return res.rows[0];
  }
}

export const paymentAttemptsRepository = new PaymentAttemptsRepository();
