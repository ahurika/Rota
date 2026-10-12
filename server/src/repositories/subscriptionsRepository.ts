import pg from 'pg';
import { dbForTeam } from '../db/shards.js';

export interface SubscriptionRow {
  team_id: string;
  plan: 'starter' | 'team' | 'business';
  seats: number;
  period_start: Date;
  period_days: number;
  status: 'trialing' | 'active' | 'past_due' | 'restricted';
  grace_ends_at: Date | null;
  pending_plan: string | null;
  pending_seats: number | null;
  updated_at: Date;
}

export const subscriptionsRepository = {
  async createStarter(teamId: string, client?: pg.PoolClient): Promise<SubscriptionRow> {
    const query = `
      INSERT INTO subscriptions (team_id, plan, seats, period_start, period_days, status)
      VALUES ($1, 'starter', 5, now(), 30, 'trialing')
      RETURNING *
    `;
    if (client) {
      const res = await client.query<SubscriptionRow>(query, [teamId]);
      return res.rows[0];
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<SubscriptionRow>(query, [teamId]);
    return res.rows[0];
  },

  async findByTeamId(teamId: string, client?: pg.PoolClient): Promise<SubscriptionRow | null> {
    const query = `SELECT * FROM subscriptions WHERE team_id = $1 LIMIT 1`;
    if (client) {
      const res = await client.query<SubscriptionRow>(query, [teamId]);
      return res.rows[0] ?? null;
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<SubscriptionRow>(query, [teamId]);
    return res.rows[0] ?? null;
  },

  /**
   * Acquires a row-level lock on the team's subscription row to serialize seat checks.
   */
  async lockForUpdate(teamId: string, client: pg.PoolClient): Promise<SubscriptionRow | null> {
    const res = await client.query<SubscriptionRow>(
      `SELECT * FROM subscriptions WHERE team_id = $1 FOR UPDATE`,
      [teamId]
    );
    return res.rows[0] ?? null;
  },
};
