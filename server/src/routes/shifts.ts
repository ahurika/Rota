import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { loadMembership, requirePermission } from '../middleware/rbac.js';
import { shiftsRepository } from '../repositories/shiftsRepository.js';
import { activityRepository } from '../repositories/activityRepository.js';
import { notificationService } from '../services/notifications/notificationService.js';
import { dbForTeam } from '../db/shards.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { TeamVariables } from './teams.js';

export const shiftsRouter = new Hono<{ Variables: TeamVariables }>();

const createShiftSchema = z
  .object({
    assigneeId: z.string().uuid().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    label: z.string().min(1).max(255),
    note: z.string().max(1000).optional(),
  })
  .strict();

const updateShiftSchema = z
  .object({
    assigneeId: z.string().uuid().optional().nullable(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    label: z.string().min(1).max(255).optional(),
    note: z.string().max(1000).optional().nullable(),
  })
  .strict();

// 1. GET /v1/teams/:teamId/shifts (List team shifts - owner, manager, staff)
shiftsRouter.get(
  '/',
  requireAuth(),
  loadMembership(),
  requirePermission('shift.read'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const fromStr = c.req.query('from');
    const toStr = c.req.query('to');

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const shifts = await shiftsRepository.listShifts(teamId, from, to);
    return c.json({ shifts }, 200);
  }
);

// 2. POST /v1/teams/:teamId/shifts (Create shift - owner, manager)
shiftsRouter.post(
  '/',
  requireAuth(),
  loadMembership(),
  requirePermission('shift.write'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const body = await c.req.json().catch(() => {
      throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
    });

    const parsed = createShiftSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    if (endsAt <= startsAt) {
      throw new AppError('VALIDATION_FAILED', 400, 'Shift endsAt must be after startsAt');
    }

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const shift = await shiftsRepository.create(
        {
          teamId,
          assigneeId: parsed.data.assigneeId,
          startsAt,
          endsAt,
          label: parsed.data.label,
          note: parsed.data.note,
        },
        client
      );

      await activityRepository.createEvent(
        {
          teamId,
          type: 'shift_created',
          actorId: c.get('userId'),
          entityId: shift.id,
          payload: { label: shift.label, startsAt: shift.starts_at, endsAt: shift.ends_at },
        },
        client
      );

      await client.query('COMMIT');

      // Dispatch push notification to assignee if assigned
      if (shift.assignee_id && shift.assignee_id !== c.get('userId')) {
        notificationService
          .processNotification({
            type: 'shift_changes',
            teamId,
            recipients: [shift.assignee_id],
            title: 'New Shift Assigned',
            body: `You were assigned a shift: ${shift.label} on ${new Date(shift.starts_at).toLocaleDateString()}.`,
            data: { shiftId: shift.id },
          })
          .catch((err) => logger.warn({ err }, 'Failed to dispatch shift assigned push notification'));
      }

      return c.json({ shift }, 201);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
);

// 3. GET /v1/teams/:teamId/shifts/:shiftId (Read shift by ID - isolated by teamId)
shiftsRouter.get(
  '/:shiftId',
  requireAuth(),
  loadMembership(),
  requirePermission('shift.read'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const shiftId = c.req.param('shiftId')!;

    const shift = await shiftsRepository.findShift(teamId, shiftId);
    if (!shift) {
      throw new AppError('NOT_FOUND', 404, 'Shift not found');
    }

    return c.json({ shift }, 200);
  }
);

// 4. PATCH /v1/teams/:teamId/shifts/:shiftId (Update shift - owner, manager)
shiftsRouter.patch(
  '/:shiftId',
  requireAuth(),
  loadMembership(),
  requirePermission('shift.write'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const shiftId = c.req.param('shiftId')!;

    const body = await c.req.json().catch(() => {
      throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
    });

    const parsed = updateShiftSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
    }

    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined;
    const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined;
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new AppError('VALIDATION_FAILED', 400, 'Shift endsAt must be after startsAt');
    }

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const shift = await shiftsRepository.updateShift(
        teamId,
        shiftId,
        {
          assigneeId: parsed.data.assigneeId,
          startsAt,
          endsAt,
          label: parsed.data.label,
          note: parsed.data.note,
        },
        client
      );

      if (!shift) {
        throw new AppError('NOT_FOUND', 404, 'Shift not found');
      }

      await activityRepository.createEvent(
        {
          teamId,
          type: 'shift_updated',
          actorId: c.get('userId'),
          entityId: shift.id,
          payload: { label: shift.label },
        },
        client
      );

      await client.query('COMMIT');

      if (shift.assignee_id && shift.assignee_id !== c.get('userId')) {
        notificationService
          .processNotification({
            type: 'shift_changes',
            teamId,
            recipients: [shift.assignee_id],
            title: 'Shift Updated',
            body: `Your shift '${shift.label}' was updated.`,
            data: { shiftId: shift.id },
          })
          .catch((err) => logger.warn({ err }, 'Failed to dispatch shift update push notification'));
      }

      return c.json({ shift }, 200);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
);

// 5. DELETE /v1/teams/:teamId/shifts/:shiftId (Delete shift - owner, manager only)
shiftsRouter.delete(
  '/:shiftId',
  requireAuth(),
  loadMembership(),
  requirePermission('shift.write'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const shiftId = c.req.param('shiftId')!;

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await shiftsRepository.findShift(teamId, shiftId, client);
      if (!existing) {
        throw new AppError('NOT_FOUND', 404, 'Shift not found');
      }

      const deleted = await shiftsRepository.deleteShift(teamId, shiftId, client);
      if (!deleted) {
        throw new AppError('NOT_FOUND', 404, 'Shift not found');
      }

      await activityRepository.createEvent(
        {
          teamId,
          type: 'shift_deleted',
          actorId: c.get('userId'),
          entityId: shiftId,
        },
        client
      );

      await client.query('COMMIT');

      if (existing.assignee_id && existing.assignee_id !== c.get('userId')) {
        notificationService
          .processNotification({
            type: 'shift_changes',
            teamId,
            recipients: [existing.assignee_id],
            title: 'Shift Cancelled',
            body: `Your shift '${existing.label}' has been cancelled.`,
            data: { shiftId },
          })
          .catch((err) => logger.warn({ err }, 'Failed to dispatch shift cancellation push notification'));
      }

      return c.json({ success: true }, 200);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
);
