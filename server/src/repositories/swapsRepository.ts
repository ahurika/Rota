import pg from 'pg';
import { dbForTeam } from '../db/shards.js';

export interface SwapRequestRow {
  id: string;
  team_id: string;
  shift_id: string;
  requester_id: string;
  target_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decided_by: string | null;
  decided_at: Date | null;
  created_at: Date;
}

export const swapsRepository = {
  async createSwapRequest(
    params: {
      teamId: string;
      shiftId: string;
      requesterId: string;
      targetId?: string | null;
    },
    client?: pg.PoolClient
  ): Promise<SwapRequestRow> {
    const query = `
      INSERT INTO swap_requests (team_id, shift_id, requester_id, target_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [params.teamId, params.shiftId, params.requesterId, params.targetId ?? null];

    if (client) {
      const res = await client.query<SwapRequestRow>(query, values);
      return res.rows[0];
    }

    const pool = await dbForTeam(params.teamId);
    const res = await pool.query<SwapRequestRow>(query, values);
    return res.rows[0];
  },

  async findById(teamId: string, swapId: string): Promise<SwapRequestRow | null> {
    const pool = await dbForTeam(teamId);
    const res = await pool.query<SwapRequestRow>(
      `SELECT * FROM swap_requests WHERE id = $1 AND team_id = $2 LIMIT 1`,
      [swapId, teamId]
    );
    return res.rows[0] ?? null;
  },

  async decideSwap(
    teamId: string,
    swapId: string,
    status: 'approved' | 'rejected',
    decidedBy: string,
    client?: pg.PoolClient
  ): Promise<SwapRequestRow | null> {
    const query = `
      UPDATE swap_requests
      SET status = $1, decided_by = $2, decided_at = now()
      WHERE id = $3 AND team_id = $4 AND status = 'pending'
      RETURNING *
    `;
    const values = [status, decidedBy, swapId, teamId];

    if (client) {
      const res = await client.query<SwapRequestRow>(query, values);
      return res.rows[0] ?? null;
    }

    const pool = await dbForTeam(teamId);
    const res = await pool.query<SwapRequestRow>(query, values);
    return res.rows[0] ?? null;
  },

  async listSwaps(
    teamId: string,
    status?: 'pending' | 'approved' | 'rejected' | 'all'
  ): Promise<Array<SwapRequestRow & {
    shift_label: string;
    shift_starts_at: Date;
    shift_ends_at: Date;
    shift_assignee_id: string | null;
  }>> {
    const pool = await dbForTeam(teamId);
    let query = `
      SELECT 
        sr.*,
        s.label AS shift_label,
        s.starts_at AS shift_starts_at,
        s.ends_at AS shift_ends_at,
        s.assignee_id AS shift_assignee_id
      FROM swap_requests sr
      JOIN shifts s ON sr.shift_id = s.id
      WHERE sr.team_id = $1
    `;
    const values: any[] = [teamId];

    if (status && status !== 'all') {
      query += ` AND sr.status = $2`;
      values.push(status);
    }

    query += ` ORDER BY sr.created_at DESC`;

    const res = await pool.query(query, values);
    return res.rows;
  },
};
