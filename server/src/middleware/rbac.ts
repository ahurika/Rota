import { createMiddleware } from 'hono/factory';
import { membershipsRepository, MembershipRow } from '../repositories/membershipsRepository.js';
import { PERMISSIONS, Permission, Role } from '../config/permissions.js';
import { AppError } from '../lib/errors.js';

export const loadMembership = () =>
  createMiddleware(async (c, next) => {
    const teamId = c.req.param('teamId');
    const userId = c.get('userId' as any) as string;

    if (!teamId) {
      throw new AppError('BAD_REQUEST', 400, 'Missing teamId parameter');
    }

    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    // Read directly from the team's shard. Never cache to support instant role revokes.
    const membership = await membershipsRepository.findMembership(teamId, userId);
    if (!membership || membership.status !== 'active') {
      // Return 404 NOT_FOUND: do not confirm that the team exists to unauthorized callers (Rule 01)
      throw new AppError('NOT_FOUND', 404, 'Team not found');
    }

    c.set('membership' as any, membership);
    await next();
  });

export const requirePermission = (permission: Permission) =>
  createMiddleware(async (c, next) => {
    const membership = c.get('membership' as any) as MembershipRow | undefined;
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Team not found');
    }

    const allowedRoles = PERMISSIONS[permission] as readonly Role[];
    if (!allowedRoles.includes(membership.role)) {
      throw new AppError('FORBIDDEN', 403, `Role '${membership.role}' lacks permission '${permission}'`);
    }

    await next();
  });
