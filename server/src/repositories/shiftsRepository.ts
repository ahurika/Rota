import pg from 'pg';
import { dbForTeam } from '../db/shards.js';
import { bumpTeamVersion, getTeamVersion, cached, TTL } from '../lib/cache.js';

export interface ShiftRow {
  id: string;
  team_id: string;
  assignee_id: string | null;
  starts_at: Date;
  ends_at: Date;
  label: string;
  note: string | null;
  updated_at: Date;
}

export const shiftsRepository = {
  async create(
    params: {
      teamId: string;
      assigneeId?: string | null;
      startsAt: Date;
      endsAt: Date;
      label: string;
      note?: string | null;
    },
    client?: pg.PoolClient
  ): Promise<ShiftRow> {
    const executor = client ?? (await dbForTeam(params.teamId));
    const res = await executor.query<ShiftRow>(
      `INSERT INTO shifts (team_id, assignee_id, starts_at, ends_at, label, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.teamId,
        params.assigneeId ?? null,
        params.startsAt,
        params.endsAt,
        params.label,
        params.note ?? null,
      ]
    );
    await bumpTeamVersion(params.teamId);
    return res.rows[0];
  },

  async findShift(teamId: string, shiftId: string, client?: pg.PoolClient): Promise<ShiftRow | null> {
    const executor = client ?? (await dbForTeam(teamId));
    const res = await executor.query<ShiftRow>(
      `SELECT * FROM shifts WHERE id = $1 AND team_id = $2 LIMIT 1`,
      [shiftId, teamId]
    );
    return res.rows[0] ?? null;
  },

  async listShifts(teamId: string, from?: Date, to?: Date): Promise<ShiftRow[]> {
    const fromStr = from ? from.toISOString() : 'all';
    const toStr = to ? to.toISOString() : 'all';
    const ver = await getTeamVersion(teamId);
    const key = `cal:${teamId}:v${ver}:${fromStr}:${toStr}`;

    return cached<ShiftRow[]>(key, TTL.CALENDAR, async () => {
      const pool = await dbForTeam(teamId);
      let query = `SELECT * FROM shifts WHERE team_id = $1`;
      const params: any[] = [teamId];

      if (from && to) {
        query += ` AND starts_at >= $2 AND starts_at <= $3`;
        params.push(from, to);
      }
      query += ` ORDER BY starts_at ASC`;

      const res = await pool.query<ShiftRow>(query, params);
      return res.rows;
    });
  },

  async updateShift(
    teamId: string,
    shiftId: string,
    params: {
      assigneeId?: string | null;
      startsAt?: Date;
      endsAt?: Date;
      label?: string;
      note?: string | null;
    },
    client?: pg.PoolClient
  ): Promise<ShiftRow | null> {
    const executor = client ?? (await dbForTeam(teamId));
    const res = await executor.query<ShiftRow>(
      `UPDATE shifts
       SET assignee_id = COALESCE($3, assignee_id),
           starts_at = COALESCE($4, starts_at),
           ends_at = COALESCE($5, ends_at),
           label = COALESCE($6, label),
           note = COALESCE($7, note),
           updated_at = now()
       WHERE id = $1 AND team_id = $2
       RETURNING *`,
      [
        shiftId,
        teamId,
        params.assigneeId,
        params.startsAt,
        params.endsAt,
        params.label,
        params.note,
      ]
    );
    if (res.rows.length > 0) {
      await bumpTeamVersion(teamId);
    }
    return res.rows[0] ?? null;
  },

  async deleteShift(teamId: string, shiftId: string, client?: pg.PoolClient): Promise<boolean> {
    const executor = client ?? (await dbForTeam(teamId));
    const res = await executor.query(
      `DELETE FROM shifts WHERE id = $1 AND team_id = $2`,
      [shiftId, teamId]
    );
    const deleted = (res.rowCount ?? 0) > 0;
    if (deleted) {
      await bumpTeamVersion(teamId);
    }
    return deleted;
  },
};
