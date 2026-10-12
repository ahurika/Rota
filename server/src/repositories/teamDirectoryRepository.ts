import { primaryPool0 } from '../db/shards.js';
import { Role } from '../config/permissions.js';

export interface TeamDirectoryEntry {
  user_id: string;
  team_id: string;
  role: Role;
  shard: number;
  created_at: Date;
}

export const teamDirectoryRepository = {
  async addEntry(userId: string, teamId: string, role: Role, shard: number): Promise<void> {
    await primaryPool0.query(
      `INSERT INTO team_directory (user_id, team_id, role, shard)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, team_id) DO UPDATE SET role = EXCLUDED.role, shard = EXCLUDED.shard`,
      [userId, teamId, role, shard]
    );
  },

  async removeEntry(userId: string, teamId: string): Promise<void> {
    await primaryPool0.query(
      `DELETE FROM team_directory WHERE user_id = $1 AND team_id = $2`,
      [userId, teamId]
    );
  },

  async updateRole(userId: string, teamId: string, role: Role): Promise<void> {
    await primaryPool0.query(
      `UPDATE team_directory SET role = $1 WHERE user_id = $2 AND team_id = $3`,
      [role, userId, teamId]
    );
  },

  async listForUser(userId: string): Promise<TeamDirectoryEntry[]> {
    const res = await primaryPool0.query<TeamDirectoryEntry>(
      `SELECT * FROM team_directory WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return res.rows;
  },
};
