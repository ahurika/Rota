import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { loadMembership, requirePermission } from '../middleware/rbac.js';
import { swapsRepository } from '../repositories/swapsRepository.js';
import { shiftsRepository } from '../repositories/shiftsRepository.js';
import { activityRepository } from '../repositories/activityRepository.js';
import { dbForTeam } from '../db/shards.js';
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

// 1. POST /v1/teams/:teamId/swaps (Request a shift swap)
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

// 2. POST /v1/teams/:teamId/swaps/:swapId/decision (Approve or reject a swap)
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
      return c.json({ swap: updatedSwap }, 200);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
);
