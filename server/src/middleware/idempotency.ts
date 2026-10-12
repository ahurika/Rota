import { Context, Next } from 'hono';
import crypto from 'node:crypto';
import { idempotencyRepository } from '../repositories/idempotencyRepository.js';

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(',')}}`;
}

export function computeRequestHash(method: string, path: string, bodyObj: any): string {
  const canonicalBody = canonicalJsonStringify(bodyObj ?? {});
  const payload = `${method.toUpperCase()}:${path}:${canonicalBody}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function requireIdempotency(c: Context, next: Next) {
  const userId = (c.get('userId' as any) as string) || (c.get('user' as any)?.id as string);
  if (!userId) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const idempotencyKey = c.req.header('idempotency-key') || c.req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return c.json(
      { error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' } },
      400
    );
  }

  let body: any = {};
  try {
    const raw = await c.req.raw.clone().text();
    if (raw && raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch {
    body = {};
  }

  const requestHash = computeRequestHash(c.req.method, c.req.path, body);

  const inserted = await idempotencyRepository.insertInProgress(userId, idempotencyKey, requestHash);
  if (!inserted) {
    const existing = await idempotencyRepository.findByKey(userId, idempotencyKey);
    if (!existing) {
      return c.json({ error: { code: 'SERVER_ERROR', message: 'Idempotency lookup failed' } }, 500);
    }

    if (existing.requestHash !== requestHash) {
      return c.json(
        {
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency-Key cannot be reused with a different request payload',
          },
        },
        422
      );
    }

    if (existing.status === 'in_progress') {
      return c.json(
        {
          error: {
            code: 'REQUEST_IN_PROGRESS',
            message: 'A request with this Idempotency-Key is currently in progress. Please retry.',
          },
        },
        409
      );
    }

    if (existing.status === 'done' && existing.response) {
      return c.json(existing.response.body, existing.response.status || 200);
    }
  }

  // Execute downstream handler
  try {
    await next();

    // If response is successful, store response
    if (c.res && c.res.status >= 200 && c.res.status < 300) {
      const cloned = c.res.clone();
      let resJson: any = null;
      try {
        resJson = await cloned.json();
      } catch {
        resJson = {};
      }
      await idempotencyRepository.updateDone(userId, idempotencyKey, {
        status: c.res.status,
        body: resJson,
      });
    } else {
      // Non-2xx response: delete idempotency key so user can retry safely
      await idempotencyRepository.deleteKey(userId, idempotencyKey);
    }
  } catch (err) {
    await idempotencyRepository.deleteKey(userId, idempotencyKey);
    throw err;
  }
}
