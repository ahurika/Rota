import pg from 'pg';
import { dbForTeam, primaryPool0, primaryPool1 } from '../db/shards.js';
import { Role } from '../config/permissions.js';

export interface InviteRow {
  id: string;
  team_id: string;
  email: string;
  role: Role;
  token_hash: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: Date;
  created_at: Date;
}

export const invitesRepository = {
  async createInvite(
    params: {
      teamId: string;
      email: string;
      role: Role;
      tokenHash: string;
      expiresAt: Date;
    },
    client?: pg.PoolClient
  ): Promise<InviteRow> {
    const query = `
      INSERT INTO invites (team_id, email, role, token_hash, expires_at)
      VALUES ($1, LOWER($2), $3, $4, $5)
      RETURNING *
    `;
    const values = [params.teamId, params.email, params.role, params.tokenHash, params.expiresAt];
    if (client) {
      const res = await client.query<InviteRow>(query, values);
      return res.rows[0];
    }
    const pool = await dbForTeam(params.teamId);
    const res = await pool.query<InviteRow>(query, values);
    return res.rows[0];
  },

  async countPending(teamId: string, client?: pg.PoolClient): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM invites
      WHERE team_id = $1 AND status = 'pending' AND expires_at > now()
    `;
    if (client) {
      const res = await client.query<{ count: string }>(query, [teamId]);
      return parseInt(res.rows[0]?.count ?? '0', 10);
    }
    const pool = await dbForTeam(teamId);
    const res = await pool.query<{ count: string }>(query, [teamId]);
    return parseInt(res.rows[0]?.count ?? '0', 10);
  },

  /**
   * Finds a pending invite by token hash across both shards.
   */
  async findPendingByTokenHash(tokenHash: string): Promise<InviteRow | null> {
    const query = `
      SELECT * FROM invites
      WHERE token_hash = $1 AND status = 'pending' AND expires_at > now()
      LIMIT 1
    `;
    const res0 = await primaryPool0.query<InviteRow>(query, [tokenHash]);
    if (res0.rows.length > 0) return res0.rows[0];

    const res1 = await primaryPool1.query<InviteRow>(query, [tokenHash]);
    if (res1.rows.length > 0) return res1.rows[0];

    return null;
  },

  async markAccepted(teamId: string, inviteId: string, client?: pg.PoolClient): Promise<void> {
    const query = `UPDATE invites SET status = 'accepted' WHERE id = $1 AND team_id = $2`;
    if (client) {
      await client.query(query, [inviteId, teamId]);
    } else {
      const pool = await dbForTeam(teamId);
      await pool.query(query, [inviteId, teamId]);
    }
  },
};
