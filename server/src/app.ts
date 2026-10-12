import { Hono } from 'hono';
import { requestId } from './middleware/requestId.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { teamsRouter, invitesRouter } from './routes/teams.js';
import { shiftsRouter } from './routes/shifts.js';

export type AppVariables = {
  requestId: string;
};

export const app = new Hono<{ Variables: AppVariables }>();

// 1. Request ID middleware (first in pipeline)
app.use('*', requestId());

// 2. Structured request logger
app.use('*', async (c, next) => {
  const start = Date.now();
  const reqId = c.get('requestId');
  const path = c.req.path;
  const method = c.req.method;

  await next();

  const durationMs = Date.now() - start;
  const status = c.res.status;

  logger.info({
    requestId: reqId,
    method,
    route: path,
    status,
    durationMs,
  });
});

// Liveness health check
app.route('/health', healthRouter);

// V1 API Routes
app.route('/v1/auth', authRouter);
app.route('/v1/teams', teamsRouter);
app.route('/v1/invites', invitesRouter);
app.route('/v1/teams/:teamId/shifts', shiftsRouter);

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
