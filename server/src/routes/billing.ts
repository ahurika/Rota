import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { loadMembership, requirePermission } from '../middleware/rbac.js';
import { requireIdempotency } from '../middleware/idempotency.js';
import { billingService } from '../services/billing/billingService.js';
import { PlanId } from '../config/plans.js';

const changeSubscriptionSchema = z.object({
  plan: z.enum(['starter', 'team', 'business']),
  seats: z.number().int().min(1),
}).strict();

export const billingRouter = new Hono();

// 1. Get current billing status
billingRouter.get(
  '/teams/:teamId/billing',
  requireAuth(),
  loadMembership(),
  requirePermission('billing.view'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const sub = await billingService.getBilling(teamId);
    return c.json({ subscription: sub }, 200);
  }
);

// 2. Preview proration changes without side effects
billingRouter.post(
  '/teams/:teamId/billing/preview',
  requireAuth(),
  loadMembership(),
  requirePermission('billing.view'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const body = await c.req.json();
    const parsed = changeSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid plan or seats', details: parsed.error.issues } },
        400
      );
    }

    const result = await billingService.previewChange(
      teamId,
      parsed.data.plan as PlanId,
      parsed.data.seats
    );
    return c.json(result, 200);
  }
);

// 3. Mutating subscription change (requires Idempotency-Key and billing.change permission)
billingRouter.post(
  '/teams/:teamId/billing/change',
  requireAuth(),
  loadMembership(),
  requirePermission('billing.change'),
  requireIdempotency,
  async (c) => {
    const teamId = c.req.param('teamId');
    const userId = c.get('userId' as any) as string;
    const userEmail = (c.get('userEmail' as any) as string) || 'user@example.com';
    const idempotencyKey = c.req.header('idempotency-key') || c.req.header('Idempotency-Key')!;

    const body = await c.req.json();
    const parsed = changeSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid plan or seats', details: parsed.error.issues } },
        400
      );
    }

    const result = await billingService.changeSubscription({
      teamId,
      userId,
      userEmail,
      newPlan: parsed.data.plan as PlanId,
      newSeats: parsed.data.seats,
      idempotencyKey,
    });

    return c.json(result, 200);
  }
);
