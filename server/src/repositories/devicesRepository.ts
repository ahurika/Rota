import { primaryPool0 } from '../db/shards.js';

export interface DeviceRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: string;
  device_id: string | null;
  last_seen_at: Date;
  created_at: Date;
}

export class DevicesRepository {
  public async upsertDevice(params: {
    userId: string;
    expoPushToken: string;
    platform: string;
    deviceId?: string | null;
  }): Promise<DeviceRow> {
    const res = await primaryPool0.query<DeviceRow>(
      `INSERT INTO devices (user_id, expo_push_token, platform, device_id, last_seen_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (expo_push_token)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         device_id = EXCLUDED.device_id,
         last_seen_at = now()
       RETURNING *`,
      [params.userId, params.expoPushToken, params.platform, params.deviceId || null]
    );
    return res.rows[0];
  }

  public async listByUser(userId: string): Promise<DeviceRow[]> {
    const res = await primaryPool0.query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC`,
      [userId]
    );
    return res.rows;
  }

  public async findByToken(expoPushToken: string): Promise<DeviceRow | null> {
    const res = await primaryPool0.query<DeviceRow>(
      `SELECT * FROM devices WHERE expo_push_token = $1 LIMIT 1`,
      [expoPushToken]
    );
    return res.rows[0] || null;
  }

  public async deleteById(id: string, userId: string): Promise<boolean> {
    const res = await primaryPool0.query(
      `DELETE FROM devices WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Proof Test T14: Deletes device immediately upon receiving DeviceNotRegistered receipt.
   */
  public async deleteByToken(expoPushToken: string): Promise<boolean> {
    const res = await primaryPool0.query(
      `DELETE FROM devices WHERE expo_push_token = $1`,
      [expoPushToken]
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async deleteAllByUser(userId: string): Promise<number> {
    const res = await primaryPool0.query(
      `DELETE FROM devices WHERE user_id = $1`,
      [userId]
    );
    return res.rowCount ?? 0;
  }
}

export const devicesRepository = new DevicesRepository();
