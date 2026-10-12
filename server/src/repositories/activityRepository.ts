import pg from 'pg';
import { dbForTeam } from '../db/shards.js';

export interface ActivityEventRow {
  id: string; // BIGINT as string
  team_id: string;
  type: string;
  actor_id: string;
  entity_id: string | null;
  payload: Record<string, any>;
  created_at: Date;
}

export const activityRepository = {
  /**
   * Records an activity event, optionally participating in an ongoing transaction client.
   */
  async createEvent(
    params: {
      teamId: string;
      type: string;
      actorId: string;
      entityId?: string | null;
      payload?: Record<string, any>;
      createdAt?: Date;
    },
    client?: pg.PoolClient
  ): Promise<ActivityEventRow> {
    const query = `
      INSERT INTO activity_events (team_id, type, actor_id, entity_id, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, clock_timestamp()))
      RETURNING id::text as id, team_id, type, actor_id, entity_id, payload, created_at
    `;
    const values = [
      params.teamId,
      params.type,
      params.actorId,
      params.entityId ?? null,
      JSON.stringify(params.payload ?? {}),
      params.createdAt ?? null,
    ];

    if (client) {
      const res = await client.query<ActivityEventRow>(query, values);
      return res.rows[0];
    }

    const pool = await dbForTeam(params.teamId);
    const res = await pool.query<ActivityEventRow>(query, values);
    return res.rows[0];
  },

  /**
   * Queries activity events with keyset cursor pagination (created_at DESC, id DESC).
   * Passes limit + 1 to detect hasMore.
   */
  async listEvents(
    teamId: string,
    cursor: { timestamp: Date; id: string } | null,
    limit: number
  ): Promise<ActivityEventRow[]> {
    const pool = await dbForTeam(teamId);
    const query = `
      SELECT id::text as id, team_id, type, actor_id, entity_id, payload, created_at
      FROM activity_events
      WHERE team_id = $1
        AND ( $2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::bigint) )
      ORDER BY created_at DESC, id DESC
      LIMIT $4;
    `;

    const res = await pool.query<ActivityEventRow>(query, [
      teamId,
      cursor ? cursor.timestamp.toISOString() : null,
      cursor ? cursor.id : null,
      limit + 1,
    ]);

    return res.rows;
  },
};
