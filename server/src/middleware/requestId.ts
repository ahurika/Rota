import { createMiddleware } from 'hono/factory';
import { v4 as uuidv4 } from 'uuid';

export const requestId = () =>
  createMiddleware(async (c, next) => {
    const incomingId = c.req.header('x-request-id');
    const id = incomingId && incomingId.trim().length > 0 ? incomingId : uuidv4();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  });
