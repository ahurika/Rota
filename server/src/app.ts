import { Hono } from 'hono';
import { requestId } from './middleware/requestId.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { teamsRouter, invitesRouter } from './routes/teams.js';
import { shiftsRouter } from './routes/shifts.js';
import { activityRouter } from './routes/activity.js';
import { swapsRouter } from './routes/swaps.js';
import { billingRouter } from './routes/billing.js';
import { webhooksRouter } from './routes/webhooks.js';
import { settingsRouter } from './routes/settings.js';
import { devicesRouter } from './routes/devices.js';

import { observability } from './middleware/observability.js';

export type AppVariables = {
  requestId: string;
};

export const app = new Hono<{ Variables: AppVariables }>();

// 1. Structured request observability (requestId, durationMs, route pattern, user/team tracking)
app.use('*', observability());

// Liveness health check
app.route('/health', healthRouter);

// V1 API Routes
app.route('/v1/auth', authRouter);
app.route('/v1/teams', teamsRouter);
app.route('/v1/invites', invitesRouter);
app.route('/v1/teams/:teamId/shifts', shiftsRouter);
app.route('/v1/teams/:teamId/activity', activityRouter);
app.route('/v1/teams/:teamId/swaps', swapsRouter);
app.route('/v1', billingRouter);
app.route('/v1', webhooksRouter);
app.route('/v1/settings', settingsRouter);
app.route('/v1/devices', devicesRouter);

// Global 404 handler
app.notFound((c) => {
  const reqId = c.get('requestId') || 'unknown';
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
        requestId: reqId,
      },
    },
    404
  );
});

// Global error handler (enforces single error shape across all endpoints)
app.onError((err, c) => {
  const reqId = c.get('requestId') || 'unknown';

  if (err instanceof AppError) {
    logger.warn({
      requestId: reqId,
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
    });
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          requestId: reqId,
        },
      },
      err.statusCode as any
    );
  }

  logger.error({
    requestId: reqId,
    err,
    message: 'Unhandled server error',
  });

  return c.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred',
        requestId: reqId,
      },
    },
    500
  );
});
