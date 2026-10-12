import { primaryPool0 } from '../db/shards.js';

export interface UserSettingsRow {
  user_id: string;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  notif_types: {
    shift_changes: boolean;
    swaps: boolean;
    billing: boolean;
  };
  language: string;
  theme: string;
  updated_at_quiet_start: Date;
  updated_at_quiet_end: Date;
  updated_at_timezone: Date;
  updated_at_notif_types: Date;
  updated_at_language: Date;
  updated_at_theme: Date;
}

export class SettingsRepository {
  public async getSettings(userId: string): Promise<UserSettingsRow> {
    const check = await primaryPool0.query<UserSettingsRow>(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [userId]
    );

    if (check.rows.length > 0) {
      return check.rows[0];
    }

    // Insert default settings if row does not exist yet
    const insertRes = await primaryPool0.query<UserSettingsRow>(
      `INSERT INTO user_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId]
    );
    return insertRes.rows[0];
  }

  public async patchSettings(
    userId: string,
    patch: {
      quietStart?: string;
      quietEnd?: string;
      timezone?: string;
      notifTypes?: {
        shift_changes?: boolean;
        swaps?: boolean;
        billing?: boolean;
      };
      language?: string;
      theme?: string;
    }
  ): Promise<UserSettingsRow> {
    // Ensure row exists
    await this.getSettings(userId);

    const setClauses: string[] = [];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (patch.quietStart !== undefined) {
      setClauses.push(`quiet_start = $${paramIndex}, updated_at_quiet_start = now()`);
      values.push(patch.quietStart);
      paramIndex++;
    }

    if (patch.quietEnd !== undefined) {
      setClauses.push(`quiet_end = $${paramIndex}, updated_at_quiet_end = now()`);
      values.push(patch.quietEnd);
      paramIndex++;
    }

    if (patch.timezone !== undefined) {
      setClauses.push(`timezone = $${paramIndex}, updated_at_timezone = now()`);
      values.push(patch.timezone);
      paramIndex++;
    }

    if (patch.notifTypes !== undefined) {
      setClauses.push(`notif_types = notif_types || $${paramIndex}::jsonb, updated_at_notif_types = now()`);
      values.push(JSON.stringify(patch.notifTypes));
      paramIndex++;
    }

    if (patch.language !== undefined) {
      setClauses.push(`language = $${paramIndex}, updated_at_language = now()`);
      values.push(patch.language);
      paramIndex++;
    }

    if (patch.theme !== undefined) {
      setClauses.push(`theme = $${paramIndex}, updated_at_theme = now()`);
      values.push(patch.theme);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.getSettings(userId);
    }

    const query = `
      UPDATE user_settings
      SET ${setClauses.join(', ')}
      WHERE user_id = $1
      RETURNING *
    `;

    const res = await primaryPool0.query<UserSettingsRow>(query, values);
    return res.rows[0];
  }
}

export const settingsRepository = new SettingsRepository();
