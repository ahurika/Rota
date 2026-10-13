import { PoolClient } from 'pg';
import { dbForTeam } from '../db/shards.js';
import { Role } from '../config/permissions.js';
import { bumpTeamVersion, getTeamVersion, cached, TTL } from '../lib/cache.js';

export interface MembershipRow {
  team_id: string;
  user_id: string;
  role: Role;
  status: string;
  created_at: Date;
}

export const membershipsRepository = {
  async create(teamId: string, userId: string, role: Role, status = 'active', client?: PoolClient): Promise<MembershipRow> {
    const executor = client ?? (await dbForTeam(teamId));
    const res = await executor.query<MembershipRow>(
      `INSERT INTO memberships (team_id, user_id, role, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [teamId, userId, role, status]
    );
    await bumpTeamVersion(teamId);
    return res.rows[0];
  },

  async findMembership(teamId: string, userId: string): Promise<MembershipRow | null> {
    const pool = await dbForTeam(teamId);
    const res = await pool.query<MembershipRow>(
      `SELECT * FROM memberships WHERE team_id = $1 AND user_id = $2 LIMIT 1`,
      [teamId, userId]
    );
    return res.rows[0] ?? null;
  },

  async listByTeam(teamId: string): Promise<MembershipRow[]> {
    const ver = await getTeamVersion(teamId);
    const key = `roster:${teamId}:v${ver}`;

    return cached<MembershipRow[]>(key, TTL.ROSTER, async () => {
      const pool = await dbForTeam(teamId);
      const res = await pool.query<MembershipRow>(
        `SELECT * FROM memberships WHERE team_id = $1 ORDER BY created_at ASC`,
        [teamId]
      );
      return res.rows;
    });
  },

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const pool = await dbForTeam(teamId);
    const res = await pool.query(
      `DELETE FROM memberships WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );
    const deleted = (res.rowCount ?? 0) > 0;
    if (deleted) {
      await bumpTeamVersion(teamId);
    }
    return deleted;
  },

  async updateRole(teamId: string, userId: string, role: Role): Promise<void> {
    const pool = await dbForTeam(teamId);
    await pool.query(
      `UPDATE memberships SET role = $1 WHERE team_id = $2 AND user_id = $3`,
      [role, teamId, userId]
    );
    await bumpTeamVersion(teamId);
  },

  async countActiveMembers(teamId: string, client?: PoolClient): Promise<number> {
    const executor = client ?? (await dbForTeam(teamId));
    const res = await executor.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM memberships WHERE team_id = $1 AND status = 'active'`,
      [teamId]
    );
    return parseInt(res.rows[0]?.count ?? '0', 10);
  },
};

