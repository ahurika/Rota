import { dbForTeam } from '../../db/shards.js';
import { subscriptionsRepository, SubscriptionRow } from '../../repositories/subscriptionsRepository.js';
import { paymentAttemptsRepository } from '../../repositories/paymentAttemptsRepository.js';
import { ledgerRepository } from '../../repositories/ledgerRepository.js';
import { membershipsRepository } from '../../repositories/membershipsRepository.js';
import { invitesRepository } from '../../repositories/invitesRepository.js';
import { activityRepository } from '../../repositories/activityRepository.js';
import { prorateChange, monthlyCents, DomainError } from './proration.js';
import { paymentProvider } from './paymentProvider.js';
import { PLANS, PlanId } from '../../config/plans.js';
import { AppError } from '../../lib/errors.js';

export class BillingService {
  public async getBilling(teamId: string): Promise<SubscriptionRow> {
    const sub = await subscriptionsRepository.findByTeamId(teamId);
    if (!sub) {
      throw new AppError(404, 'NOT_FOUND', 'Subscription not found for this team');
    }
    return sub;
  }

  public async previewChange(
    teamId: string,
    newPlan: PlanId,
    newSeats: number
  ) {
    const sub = await this.getBilling(teamId);
    const planConfig = PLANS[newPlan];
    if (!planConfig) {
      throw new AppError(400, 'INVALID_PLAN', 'Unknown plan specified');
    }
    if (newSeats < 1 || newSeats > planConfig.maxSeats) {
      throw new AppError(400, 'SEATS_OUT_OF_RANGE', `Seats must be between 1 and ${planConfig.maxSeats}`);
    }

    const proration = prorateChange({
      oldPlan: sub.plan,
      oldSeats: sub.seats,
      newPlan,
      newSeats,
      periodStart: sub.period_start,
      periodDays: sub.period_days,
      now: new Date(),
    });

    return {
      currentPlan: sub.plan,
      currentSeats: sub.seats,
      newPlan,
      newSeats,
      proration,
    };
  }

  public async changeSubscription(params: {
    teamId: string;
    userId: string;
    userEmail: string;
    newPlan: PlanId;
    newSeats: number;
    idempotencyKey: string;
    simulatePayment?: boolean;
  }) {
    const { teamId, userId, userEmail, newPlan, newSeats, idempotencyKey, simulatePayment } = params;
    const planConfig = PLANS[newPlan];
    if (!planConfig) {
      throw new AppError(400, 'INVALID_PLAN', 'Unknown plan specified');
    }
    if (newSeats < 1 || newSeats > planConfig.maxSeats) {
      throw new AppError(400, 'SEATS_OUT_OF_RANGE', `Seats must be between 1 and ${planConfig.maxSeats}`);
    }

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const sub = await subscriptionsRepository.lockForUpdate(teamId, client);
      if (!sub) {
        throw new AppError(404, 'NOT_FOUND', 'Subscription not found');
      }

      // Check seats cannot drop below current active members + pending invites
      const activeMembers = await membershipsRepository.countActiveMembers(teamId, client);
      const pendingInvites = await invitesRepository.countPending(teamId, client);
      const currentOccupied = activeMembers + pendingInvites;

      if (newSeats < currentOccupied) {
        throw new AppError(
          400,
          'SEATS_BELOW_OCCUPANCY',
          `Cannot reduce seats to ${newSeats}. Team has ${activeMembers} active members and ${pendingInvites} pending invites (${currentOccupied} total).`
        );
      }

      const proration = prorateChange({
        oldPlan: sub.plan,
        oldSeats: sub.seats,
        newPlan,
        newSeats,
        periodStart: sub.period_start,
        periodDays: sub.period_days,
        now: new Date(),
      });

      // Direction: Scheduled downgrade
      if (proration.kind === 'scheduled') {
        const updated = await subscriptionsRepository.updatePendingChange(teamId, newPlan, newSeats, client);
        await activityRepository.createEvent(
          {
            teamId,
            type: 'subscription_downgrade_scheduled',
            actorId: userId,
            entityId: null,
            payload: { newPlan, newSeats, effectiveAt: proration.effectiveAt },
          },
          client
        );
        await client.query('COMMIT');

        return {
          status: 'scheduled',
          kind: 'scheduled',
          chargeCents: 0,
          effectiveAt: proration.effectiveAt,
          subscription: updated,
        };
      }

      // Direction: Immediate change
      if (proration.chargeCents > 0) {
        if (simulatePayment) {
          const attempt = await paymentAttemptsRepository.create(
            teamId,
            {
              kind: 'change',
              amountCents: proration.chargeCents,
              currency: 'USD',
              idempotencyKey,
              status: 'succeeded',
              requestedPlan: newPlan,
              requestedSeats: newSeats,
            },
            client
          );

          const providerRef = `sim_${attempt.id}`;
          await client.query(
            `UPDATE payment_attempts SET provider_ref = $1 WHERE id = $2`,
            [providerRef, attempt.id]
          );

          await ledgerRepository.insertEntry(
            teamId,
            {
              type: 'charge',
              amountCents: proration.chargeCents,
              currency: 'USD',
              plan: newPlan,
              seats: newSeats,
              reason: 'subscription_charge',
              idempotencyKey: `attempt:${attempt.id}`,
              providerRef,
            },
            client
          );

          const updated = await subscriptionsRepository.updatePlanAndSeats(
            teamId,
            newPlan,
            newSeats,
            client
          );

          await activityRepository.createEvent(
            {
              teamId,
              type: 'subscription_charge_succeeded',
              actorId: userId,
              entityId: attempt.id,
              payload: { amountCents: proration.chargeCents, plan: newPlan, seats: newSeats },
            },
            client
          );

          await client.query('COMMIT');

          return {
            status: 'applied',
            kind: 'immediate',
            chargeCents: proration.chargeCents,
            subscription: updated,
            simulated: true,
          };
        }

        // Live checkout session flow
        const attempt = await paymentAttemptsRepository.create(
          teamId,
          {
            kind: 'change',
            amountCents: proration.chargeCents,
            currency: 'USD',
            idempotencyKey,
            status: 'pending',
            requestedPlan: newPlan,
            requestedSeats: newSeats,
          },
          client
        );

        const providerRef = `att_${attempt.id}`;
        await client.query(
          `UPDATE payment_attempts SET provider_ref = $1 WHERE id = $2`,
          [providerRef, attempt.id]
        );

        const checkout = await paymentProvider.createCheckoutSession({
          amountCents: proration.chargeCents,
          currency: 'USD',
          email: userEmail,
          reference: providerRef,
        });

        await client.query('COMMIT');

        return {
          status: 'payment_required',
          kind: 'immediate',
          chargeCents: proration.chargeCents,
          attemptId: attempt.id,
          providerRef,
          checkoutUrl: checkout.checkoutUrl,
        };
      }

      // Immediate with charge 0 (e.g. changing seats within included allowance)
      const updated = await subscriptionsRepository.updatePlanAndSeats(teamId, newPlan, newSeats, client);
      await ledgerRepository.insertEntry(
        teamId,
        {
          type: 'adjustment',
          amountCents: 0,
          currency: 'USD',
          plan: newPlan,
          seats: newSeats,
          reason: 'seat_change_no_charge',
          idempotencyKey,
        },
        client
      );

      await activityRepository.createEvent(
        {
          teamId,
          type: 'subscription_changed',
          actorId: userId,
          entityId: null,
          payload: { plan: newPlan, seats: newSeats, chargeCents: 0 },
        },
        client
      );

      await client.query('COMMIT');

      return {
        status: 'applied',
        kind: 'immediate',
        chargeCents: 0,
        subscription: updated,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async rebuildSubscriptionFromLedger(teamId: string) {
    return ledgerRepository.rebuildSubscriptionFromLedger(teamId);
  }
}

export const billingService = new BillingService();
