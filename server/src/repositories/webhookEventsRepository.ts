import pg from 'pg';
import { primaryPool0, primaryPool1 } from '../db/shards.js';

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_id: string;
  payload: any;
  status: string; // 'received' | 'processed' | 'ignored'
  received_at: Date;
  processed_at: Date | null;
}

export class WebhookEventsRepository {
  /**
   * Webhooks are stored on the appropriate shard or shard 0.
   */
  public async insertIfNew(
    poolOrClient: pg.Pool | pg.PoolClient,
    provider: string,
    eventId: string,
    payload: any
  ): Promise<WebhookEventRow | null> {
    const res = await poolOrClient.query<WebhookEventRow>(
      `INSERT INTO webhook_events (provider, event_id, payload, status)
       VALUES ($1, $2, $3, 'received')
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING *`,
      [provider, eventId, JSON.stringify(payload)]
    );
    return res.rows[0] || null;
  }

  public async findByEventId(
    poolOrClient: pg.Pool | pg.PoolClient,
    provider: string,
    eventId: string
  ): Promise<WebhookEventRow | null> {
    const res = await poolOrClient.query<WebhookEventRow>(
      `SELECT * FROM webhook_events WHERE provider = $1 AND event_id = $2 LIMIT 1`,
      [provider, eventId]
    );
    return res.rows[0] || null;
  }

  public async updateProcessed(
    client: pg.PoolClient,
    id: string
  ): Promise<WebhookEventRow> {
    const res = await client.query<WebhookEventRow>(
      `UPDATE webhook_events
       SET status = 'processed', processed_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return res.rows[0];
  }

  public async updateStatus(
    client: pg.PoolClient,
    id: string,
    status: string
  ): Promise<WebhookEventRow> {
    const res = await client.query<WebhookEventRow>(
      `UPDATE webhook_events
       SET status = $2
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return res.rows[0];
  }
}

export const webhookEventsRepository = new WebhookEventsRepository();
