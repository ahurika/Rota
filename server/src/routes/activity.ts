import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { loadMembership, requirePermission } from '../middleware/rbac.js';
import { activityService } from '../services/activity.js';
import { TeamVariables } from './teams.js';

export const activityRouter = new Hono<{ Variables: TeamVariables }>();

// GET /v1/teams/:teamId/activity (Cursor pagination activity feed)
activityRouter.get(
  '/',
  requireAuth(),
  loadMembership(),
  requirePermission('activity.read'),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit');

    const result = await activityService.getFeed(teamId, cursor, limit);
    return c.json(result, 200);
  }
);
