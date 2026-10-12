import { primaryPool0 } from '../db/shards.js';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  device_id: string | null;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  replaced_by: string | null;
  created_at: Date;
}

export const refreshTokensRepository = {
  async create(params: {
    userId: string;
    familyId: string;
    deviceId?: string | null;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRow> {
    const res = await primaryPool0.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, family_id, device_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.userId, params.familyId, params.deviceId ?? null, params.tokenHash, params.expiresAt]
    );
    return res.rows[0];
  },

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const res = await primaryPool0.query<RefreshTokenRow>(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    return res.rows[0] ?? null;
  },

  /**
   * Atomically claims an unused refresh token.
   * If two concurrent requests arrive with the same token, exactly one row is returned.
   */
  async claimUnusedAtomic(id: string): Promise<boolean> {
    const res = await primaryPool0.query<{ id: string }>(
      `UPDATE refresh_tokens
       SET used_at = now()
       WHERE id = $1 AND used_at IS NULL
       RETURNING id`,
      [id]
    );
    return res.rows.length > 0;
  },

  async setReplacedBy(oldId: string, newId: string): Promise<void> {
    await primaryPool0.query(
      `UPDATE refresh_tokens SET replaced_by = $1 WHERE id = $2`,
      [newId, oldId]
    );
  },

  /**
   * Revokes all refresh tokens in a family upon detecting replay / token reuse.
   */
  async revokeFamily(familyId: string): Promise<void> {
    await primaryPool0.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1`,
      [familyId]
    );
  },

  /**
   * Revokes all refresh tokens for a user (e.g. on logout-all or password reset).
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await primaryPool0.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1`,
      [userId]
    );
  },
};
