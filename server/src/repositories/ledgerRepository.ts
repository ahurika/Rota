import pg from 'pg';
import { dbForTeam } from '../db/shards.js';

export interface LedgerEntryRow {
  id: string;
  team_id: string;
  type: 'charge' | 'credit' | 'refund' | 'adjustment';
  amount_cents: number;
  currency: string;
  plan: string;
  seats: number;
  reason: string;
  idempotency_key: string;
  provider_ref: string | null;
  created_at: Date;
}

export interface RebuiltSubscriptionState {
  teamId: string;
  plan: string;
  seats: number;
  status: string;
}

export class LedgerRepository {
  public async insertEntry(
    teamId: string,
    entry: {
      type: 'charge' | 'credit' | 'refund' | 'adjustment';
      amountCents: number;
      currency?: string;
      plan: string;
      seats: number;
      reason: string;
      idempotencyKey: string;
      providerRef?: string | null;
    },
    client?: pg.PoolClient
  ): Promise<LedgerEntryRow> {
    const query = `
      INSERT INTO ledger_entries (
        team_id, type, amount_cents, currency, plan, seats, reason, idempotency_key, provider_ref
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const params = [
      teamId,
      entry.type,
      entry.amountCents,
      entry.currency || 'USD',
      entry.plan,
      entry.seats,
      entry.reason,
      entry.idempotencyKey,
      entry.providerRef || null,
    ];

    if (client) {
      const res = await client.query<LedgerEntryRow>(query, params);
      return res.rows[0];
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<LedgerEntryRow>(query, params);
    return res.rows[0];
  }

  public async getEntriesByTeam(
    teamId: string,
    client?: pg.PoolClient
  ): Promise<LedgerEntryRow[]> {
    const query = `
      SELECT * FROM ledger_entries
      WHERE team_id = $1
      ORDER BY created_at ASC, id ASC
    `;
    if (client) {
      const res = await client.query<LedgerEntryRow>(query, [teamId]);
      return res.rows;
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<LedgerEntryRow>(query, [teamId]);
    return res.rows;
  }

  /**
   * Proof Test T12: Rebuilds current subscription state by replaying append-only ledger entries.
   */
  public async rebuildSubscriptionFromLedger(
    teamId: string,
    client?: pg.PoolClient
  ): Promise<RebuiltSubscriptionState> {
    const entries = await this.getEntriesByTeam(teamId, client);

    let currentPlan = 'starter';
    let currentSeats = 5;
    let currentStatus = 'trialing';

    for (const entry of entries) {
      if (entry.type === 'charge' || entry.type === 'adjustment') {
        currentPlan = entry.plan;
        currentSeats = entry.seats;
        currentStatus = 'active';
      }
    }

    return {
      teamId,
      plan: currentPlan,
      seats: currentSeats,
      status: currentStatus,
    };
  }
}

export const ledgerRepository = new LedgerRepository();
