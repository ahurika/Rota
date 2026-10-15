import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { loadMembership, requirePermission } from '../middleware/rbac.js';
import { swapsRepository } from '../repositories/swapsRepository.js';
import { shiftsRepository } from '../repositories/shiftsRepository.js';
import { activityRepository } from '../repositories/activityRepository.js';
import { membershipsRepository } from '../repositories/membershipsRepository.js';
import { usersRepository } from '../repositories/usersRepository.js';
import { notificationService } from '../services/notifications/notificationService.js';
import { dbForTeam } from '../db/shards.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { TeamVariables } from './teams.js';

export const swapsRouter = new Hono<{ Variables: TeamVariables }>();

const createSwapSchema = z
  .object({
    shiftId: z.string().uuid(),
    targetId: z.string().uuid().optional().nullable(),
  })
  .strict();

const decideSwapSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
  })
  .strict();

const listSwapsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
});

// 1. GET /v1/teams/:teamId/swaps (List team swaps)
swapsRouter.get(
  '/',
  requireAuth(),
  loadMembership(),
  requirePermission('swap.request'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const statusParam = c.req.query('status') as 'pending' | 'approved' | 'rejected' | 'all' | undefined;
    const parsedQuery = listSwapsQuerySchema.safeParse({ status: statusParam });
    const status = parsedQuery.success ? parsedQuery.data.status : undefined;

    const rows = await swapsRepository.listSwaps(teamId, status);

    // Collect user IDs to batch resolve emails
    const userIds = new Set<string>();
    for (const r of rows) {
      if (r.requester_id) userIds.add(r.requester_id);
      if (r.target_id) userIds.add(r.target_id);
      if (r.decided_by) userIds.add(r.decided_by);
    }

    const userMap = await usersRepository.findByIds(Array.from(userIds));

    const swaps = rows.map((r) => {
      const requester = userMap.get(r.requester_id);
      const target = r.target_id ? userMap.get(r.target_id) : null;
      return {
        id: r.id,
        team_id: r.team_id,
        shift_id: r.shift_id,
        requester_id: r.requester_id,
        requester_email: requester?.email ?? 'Staff Member',
        target_id: r.target_id,
        target_email: target?.email ?? null,
        status: r.status,
        decided_by: r.decided_by,
        decided_at: r.decided_at,
        created_at: r.created_at,
        shift_label: r.shift_label,
        shift_starts_at: r.shift_starts_at,
        shift_ends_at: r.shift_ends_at,
        shift_assignee_id: r.shift_assignee_id,
      };
    });

    return c.json({ swaps }, 200);
  }
);

// 2. POST /v1/teams/:teamId/swaps (Request a shift swap)
swapsRouter.post(
  '/',
  requireAuth(),
  loadMembership(),
  requirePermission('swap.request'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const userId = c.get('userId');

    const body = await c.req.json().catch(() => {
      throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
    });

    const parsed = createSwapSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
    }

    const shift = await shiftsRepository.findShift(teamId, parsed.data.shiftId);
    if (!shift) {
      throw new AppError('NOT_FOUND', 404, 'Shift not found');
    }

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const swap = await swapsRepository.createSwapRequest(
        {
          teamId,
          shiftId: parsed.data.shiftId,
          requesterId: userId,
          targetId: parsed.data.targetId,
        },
        client
      );

      await activityRepository.createEvent(
        {
          teamId,
          type: 'swap_requested',
          actorId: userId,
          entityId: swap.id,
          payload: {
            shiftId: parsed.data.shiftId,
            targetId: parsed.data.targetId,
          },
        },
        client
      );

      await client.query('COMMIT');

      // Dispatch push notification to managers/owners & target colleague
      try {
        const recipients: string[] = [];
        if (parsed.data.targetId && parsed.data.targetId !== userId) {
          recipients.push(parsed.data.targetId);
        }
        const members = await membershipsRepository.listByTeam(teamId);
        const managers = members.filter(
          (m) => (m.role === 'manager' || m.role === 'owner') && m.user_id !== userId
        );
        for (const m of managers) {
          if (!recipients.includes(m.user_id)) recipients.push(m.user_id);
        }

        if (recipients.length > 0) {
          notificationService
            .processNotification({
              type: 'swaps',
              teamId,
              recipients,
              title: 'Shift Swap Requested',
              body: `A shift swap was requested for '${shift.label}'.`,
              data: { swapId: swap.id, shiftId: shift.id },
            })
            .catch((err) => logger.warn({ err }, 'Failed to dispatch swap request notification'));
        }
      } catch (notifErr) {
        logger.warn({ notifErr }, 'Error queuing swap request notification');
      }

      return c.json({ swap }, 201);
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505') {
        throw new AppError('SWAP_ALREADY_PENDING', 409, 'A pending swap already exists for this shift');
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

// 3. POST /v1/teams/:teamId/swaps/:swapId/decision (Approve or reject a swap)
swapsRouter.post(
  '/:swapId/decision',
  requireAuth(),
  loadMembership(),
  requirePermission('swap.decide'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const swapId = c.req.param('swapId')!;
    const userId = c.get('userId');

    const body = await c.req.json().catch(() => {
      throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
    });

    const parsed = decideSwapSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
    }

    const existingSwap = await swapsRepository.findById(teamId, swapId);
    if (!existingSwap || existingSwap.status !== 'pending') {
      throw new AppError('NOT_FOUND', 404, 'Pending swap request not found');
    }

    // Extra check per permissions matrix: requester cannot decide their own swap
    if (existingSwap.requester_id === userId) {
      throw new AppError('FORBIDDEN', 403, 'Requesters cannot decide their own swap request');
    }

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updatedSwap = await swapsRepository.decideSwap(
        teamId,
        swapId,
        parsed.data.status,
        userId,
        client
      );

      if (!updatedSwap) {
        throw new AppError('NOT_FOUND', 404, 'Pending swap request not found');
      }

      // If approved and a target assignee was requested, update shift assignee
      if (parsed.data.status === 'approved' && existingSwap.target_id) {
        await shiftsRepository.updateShift(
          teamId,
          existingSwap.shift_id,
          { assigneeId: existingSwap.target_id },
          client
        );
      }

      await activityRepository.createEvent(
        {
          teamId,
          type: parsed.data.status === 'approved' ? 'swap_approved' : 'swap_rejected',
          actorId: userId,
          entityId: swapId,
          payload: {
            shiftId: existingSwap.shift_id,
            requesterId: existingSwap.requester_id,
            targetId: existingSwap.target_id,
          },
        },
        client
      );

      await client.query('COMMIT');

      // Dispatch push notification to requester (and target colleague)
      try {
        const recipients: string[] = [existingSwap.requester_id];
        if (
          existingSwap.target_id &&
          existingSwap.target_id !== userId &&
          !recipients.includes(existingSwap.target_id)
        ) {
          recipients.push(existingSwap.target_id);
        }
        const isApproved = parsed.data.status === 'approved';
        notificationService
          .processNotification({
            type: 'swaps',
            teamId,
            recipients,
            title: isApproved ? 'Shift Swap Approved' : 'Shift Swap Rejected',
            body: isApproved
              ? 'Your shift swap request was approved by the manager.'
              : 'Your shift swap request was rejected.',
            data: { swapId, status: parsed.data.status },
          })
          .catch((err) => logger.warn({ err }, 'Failed to dispatch swap decision notification'));
      } catch (notifErr) {
        logger.warn({ notifErr }, 'Error queuing swap decision notification');
      }

      return c.json({ swap: updatedSwap }, 200);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
);
