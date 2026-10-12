import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { loadMembership, requirePermission } from '../middleware/rbac.js';
import { teamsService } from '../services/teams.js';
import { membershipsRepository } from '../repositories/membershipsRepository.js';
import { AppError } from '../lib/errors.js';
import { MembershipRow } from '../repositories/membershipsRepository.js';

export type TeamVariables = {
  userId: string;
  familyId: string;
  membership?: MembershipRow;
};

export const teamsRouter = new Hono<{ Variables: TeamVariables }>();

const createTeamSchema = z
  .object({
    name: z.string().min(2).max(100),
  })
  .strict();

const inviteSchema = z
  .object({
    email: z.string().email().max(255),
    role: z.enum(['owner', 'manager', 'staff']),
  })
  .strict();

const acceptInviteSchema = z
  .object({
    token: z.string().min(20).max(512),
  })
  .strict();

// 1. POST /v1/teams (Create team, creator becomes owner)
teamsRouter.post('/', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  const result = await teamsService.createTeam(userId, parsed.data.name);
  return c.json(result, 201);
});

// 2. GET /v1/teams (List teams for current user via team_directory)
teamsRouter.get('/', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const teams = await teamsService.listUserTeams(userId);
  return c.json({ teams }, 200);
});

// 3. GET /v1/teams/:teamId/members (List team members)
teamsRouter.get('/:teamId/members', requireAuth(), loadMembership(), async (c) => {
  const teamId = c.req.param('teamId');
  const members = await membershipsRepository.listByTeam(teamId);
  return c.json({ members }, 200);
});

// 4. POST /v1/teams/:teamId/invites (Invite member, seat checked)
teamsRouter.post(
  '/:teamId/invites',
  requireAuth(),
  loadMembership(),
  requirePermission('team.invite'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const membership = c.get('membership')!;

    const body = await c.req.json().catch(() => {
      throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
    });

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
    }

    const result = await teamsService.inviteMember(
      teamId,
      membership.role,
      parsed.data.email,
      parsed.data.role
    );
    return c.json(result, 201);
  }
);

// 5. POST /v1/invites/accept (Accept invite via deep link token)
export const invitesRouter = new Hono<{ Variables: TeamVariables }>();

invitesRouter.post('/accept', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  const result = await teamsService.acceptInvite(userId, parsed.data.token);
  return c.json(result, 200);
});
