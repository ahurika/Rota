import { primaryPool0, readPool0 } from '../db/shards.js';

export interface IdempotencyRecord {
  userId: string;
  key: string;
  requestHash: string;
  status: 'in_progress' | 'done';
  response: any;
  createdAt: Date;
}

export class IdempotencyRepository {
  public async insertInProgress(userId: string, key: string, requestHash: string): Promise<boolean> {
    const res = await primaryPool0.query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash, status)
       VALUES ($1, $2, $3, 'in_progress')
       ON CONFLICT (user_id, key) DO NOTHING
       RETURNING key`,
      [userId, key, requestHash]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }

  public async findByKey(userId: string, key: string): Promise<IdempotencyRecord | null> {
    const res = await primaryPool0.query(
      `SELECT user_id as "userId", key, request_hash as "requestHash", status, response, created_at as "createdAt"
       FROM idempotency_keys
       WHERE user_id = $1 AND key = $2`,
      [userId, key]
    );
    return res.rows[0] || null;
  }

  public async updateDone(userId: string, key: string, response: any): Promise<void> {
    await primaryPool0.query(
      `UPDATE idempotency_keys
       SET status = 'done', response = $3
       WHERE user_id = $1 AND key = $2`,
      [userId, key, JSON.stringify(response)]
    );
  }

  public async deleteKey(userId: string, key: string): Promise<void> {
    await primaryPool0.query(
      `DELETE FROM idempotency_keys
       WHERE user_id = $1 AND key = $2`,
      [userId, key]
    );
  }
}

export const idempotencyRepository = new IdempotencyRepository();
