import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

export const observability = () =>
  createMiddleware(async (c, next) => {
    const start = performance.now();

    // 1. Resolve or generate requestId
    const incomingId = c.req.header('x-request-id');
    const requestId =
      incomingId && /^[a-zA-Z0-9_-]{1,64}$/.test(incomingId) ? incomingId : randomUUID();

    c.set('requestId' as any, requestId);
    c.header('X-Request-Id', requestId);

    try {
      await next();
    } finally {
      const durationMs = Math.round(performance.now() - start);
      const status = c.res.status;
      const method = c.req.method;

      // Extract route path pattern if matched, else fallback to pathname
      const route = c.req.routePath || c.req.path;
      const userId = (c.get('userId' as any) as string) || undefined;
      const teamId = (c.get('teamId' as any) as string) || c.req.param('teamId') || undefined;

      logger.info({
        msg: 'request',
        requestId,
        userId,
        teamId,
        method,
        route,
        status,
        durationMs,
      });
    }
  });
