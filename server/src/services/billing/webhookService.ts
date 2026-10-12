import { primaryPool0, primaryPool1, dbForTeam } from '../../db/shards.js';
import { webhookEventsRepository } from '../../repositories/webhookEventsRepository.js';
import { paymentAttemptsRepository, PaymentAttemptRow } from '../../repositories/paymentAttemptsRepository.js';
import { subscriptionsRepository } from '../../repositories/subscriptionsRepository.js';
import { ledgerRepository } from '../../repositories/ledgerRepository.js';
import { activityRepository } from '../../repositories/activityRepository.js';
import { paymentProvider } from './paymentProvider.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import pg from 'pg';

export class WebhookService {
  /**
   * Verified ingestion of provider webhooks.
   * Enforces Proof Tests T5 & T6:
   * - T6: Bad signature fails with 401 and writes nothing.
   * - T5: Duplicate webhook returns 200 and triggers zero additional ledger rows.
   */
  public async handleWebhook(provider: string, rawBody: string, signature: string | undefined | null) {
    // 1. Raw body cryptographic verification (T6)
    const isValid = paymentProvider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn({ provider }, 'Webhook signature verification failed');
      throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
    }

    // 2. Parse event payload
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new AppError(400, 'INVALID_JSON', 'Malformed JSON in webhook body');
    }

    const eventId = String(event.id || event.event_id || `${event.event || 'event'}:${event.data?.reference || Date.now()}`);

    // 3. Ingestion into webhook_events with ON CONFLICT DO NOTHING (T5)
    // Save to Shard 0 as authoritative ingestion log
    const inserted = await webhookEventsRepository.insertIfNew(primaryPool0, provider, eventId, event);

    if (!inserted) {
      // Event was already ingested previously: return 200 immediately without reprocessing (Rule 02)
      return { status: 'duplicate', eventId };
    }

    // 4. Process event
    await this.processEvent(inserted.id, provider, event);

    return { status: 'processed', eventId };
  }

  public async processEvent(webhookDbId: string, provider: string, event: any) {
    const providerRef = event.data?.reference;
    if (!providerRef) {
      const client0 = await primaryPool0.connect();
      try {
        await webhookEventsRepository.updateStatus(client0, webhookDbId, 'ignored');
      } finally {
        client0.release();
      }
      return;
    }

    // Find attempt across shards
    let targetShardPool: pg.Pool | null = null;
    let attemptRecord: PaymentAttemptRow | null = null;

    const findOnShard = async (pool: pg.Pool) => {
      const res = await pool.query<PaymentAttemptRow>(
        'SELECT * FROM payment_attempts WHERE provider_ref = $1 LIMIT 1',
        [providerRef]
      );
      return res.rows[0] || null;
    };

    attemptRecord = await findOnShard(primaryPool0);
    if (attemptRecord) {
      targetShardPool = primaryPool0;
    } else {
      attemptRecord = await findOnShard(primaryPool1);
      if (attemptRecord) {
        targetShardPool = primaryPool1;
      }
    }

    if (!attemptRecord || !targetShardPool) {
      logger.warn({ providerRef }, 'Webhook attempt reference not found, ignoring event');
      const client0 = await primaryPool0.connect();
      try {
        await webhookEventsRepository.updateStatus(client0, webhookDbId, 'ignored');
      } finally {
        client0.release();
      }
      return;
    }

    // Process on target shard inside transaction with row lock
    const client = await targetShardPool.connect();
    try {
      await client.query('BEGIN');

      const attempt = await paymentAttemptsRepository.lockByProviderRef(providerRef, client);
      if (!attempt) {
        await client.query('ROLLBACK');
        return;
      }

      if (attempt.status === 'succeeded') {
        // Already processed
        await client.query('COMMIT');
        const client0 = await primaryPool0.connect();
        try {
          await webhookEventsRepository.updateProcessed(client0, webhookDbId);
        } finally {
          client0.release();
        }
        return;
      }

      const isSuccess =
        event.event === 'charge.success' ||
        event.status === 'success' ||
        event.event === 'payment.succeeded' ||
        event.data?.status === 'success';

      if (!isSuccess) {
        await paymentAttemptsRepository.updateStatus(attempt.id, 'failed', client);
        await client.query('COMMIT');
        const client0 = await primaryPool0.connect();
        try {
          await webhookEventsRepository.updateProcessed(client0, webhookDbId);
        } finally {
          client0.release();
        }
        return;
      }

      // Check amount and currency match attempt
      const eventAmountCents = event.data?.amount !== undefined ? Number(event.data.amount) : attempt.amount_cents;
      const eventCurrency = event.data?.currency || attempt.currency;

      if (eventAmountCents !== attempt.amount_cents || eventCurrency !== attempt.currency) {
        logger.error(
          { attemptAmount: attempt.amount_cents, eventAmount: eventAmountCents },
          'Webhook amount or currency mismatch! Rejecting credit.'
        );
        await paymentAttemptsRepository.updateStatus(attempt.id, 'amount_mismatch', client);
        await client.query('COMMIT');
        return;
      }

      const targetPlan = attempt.requested_plan || 'team';
      const targetSeats = attempt.requested_seats || 15;

      // 1. Insert Ledger Entry with unique idempotency key (Rule 02)
      await ledgerRepository.insertEntry(
        attempt.team_id,
        {
          type: 'charge',
          amountCents: attempt.amount_cents,
          currency: attempt.currency,
          plan: targetPlan,
          seats: targetSeats,
          reason: 'subscription_charge',
          idempotencyKey: `attempt:${attempt.id}`,
          providerRef: attempt.provider_ref,
        },
        client
      );

      // 2. Update Subscription state
      await subscriptionsRepository.updatePlanAndSeats(
        attempt.team_id,
        targetPlan,
        targetSeats,
        client
      );

      // 3. Mark attempt succeeded
      await paymentAttemptsRepository.updateStatus(attempt.id, 'succeeded', client);

      // 4. Record Activity event
      await activityRepository.createEvent(
        {
          teamId: attempt.team_id,
          type: 'subscription_charge_succeeded',
          actorId: '00000000-0000-0000-0000-000000000000',
          entityId: attempt.id,
          payload: { amountCents: attempt.amount_cents, plan: targetPlan, seats: targetSeats },
        },
        client
      );

      await client.query('COMMIT');

      // Update webhook event status on Shard 0
      const client0 = await primaryPool0.connect();
      try {
        await webhookEventsRepository.updateProcessed(client0, webhookDbId);
      } finally {
        client0.release();
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const webhookService = new WebhookService();
