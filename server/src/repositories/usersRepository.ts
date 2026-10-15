import { primaryPool0 } from '../db/shards.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

export const usersRepository = {
  async create(email: string, passwordHash: string): Promise<UserRow> {
    const res = await primaryPool0.query<UserRow>(
      `INSERT INTO users (email, password_hash)
       VALUES (LOWER($1), $2)
       RETURNING *`,
      [email, passwordHash]
    );
    return res.rows[0];
  },

  async findByEmail(email: string): Promise<UserRow | null> {
    const res = await primaryPool0.query<UserRow>(
      `SELECT * FROM users WHERE email = LOWER($1) LIMIT 1`,
      [email]
    );
    return res.rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const res = await primaryPool0.query<UserRow>(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ?? null;
  },

  async findByIds(ids: string[]): Promise<Map<string, { id: string; email: string }>> {
    if (!ids || ids.length === 0) return new Map();
    const res = await primaryPool0.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    const map = new Map<string, { id: string; email: string }>();
    for (const row of res.rows) {
      map.set(row.id, row);
    }
    return map;
  },

  async bumpTokenVersion(id: string): Promise<number> {
    const res = await primaryPool0.query<{ token_version: number }>(
      `UPDATE users
       SET token_version = token_version + 1, updated_at = now()
       WHERE id = $1
       RETURNING token_version`,
      [id]
    );
    return res.rows[0]?.token_version ?? 0;
  },
};
