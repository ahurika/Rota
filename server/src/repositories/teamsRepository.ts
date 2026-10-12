import { dbForTeam } from '../db/shards.js';

export interface TeamRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: Date;
}

export const teamsRepository = {
  async createTeam(teamId: string, name: string, ownerId: string): Promise<TeamRow> {
    const pool = await dbForTeam(teamId);
    const res = await pool.query<TeamRow>(
      `INSERT INTO teams (id, name, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamId, name, ownerId]
    );
    return res.rows[0];
  },

  async findById(teamId: string): Promise<TeamRow | null> {
    const pool = await dbForTeam(teamId);
    const res = await pool.query<TeamRow>(
      `SELECT * FROM teams WHERE id = $1 LIMIT 1`,
      [teamId]
    );
    return res.rows[0] ?? null;
  },
};
