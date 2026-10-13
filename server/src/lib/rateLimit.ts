import { createMiddleware } from 'hono/factory';
import { getRedisClient } from '../db/shards.js';
import { logger } from './logger.js';
import { AppError } from './errors.js';

const RATE_LIMIT_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { c, ttl }
`;

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Executes atomic fixed-window rate limit hit via Redis Lua script.
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const res = (await redis.eval(RATE_LIMIT_LUA, 1, key, windowMs.toString())) as [number, number];
  const count = Number(res[0]);
  const ttlMs = Number(res[1]);

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));

  return {
    allowed,
    count,
    remaining,
    retryAfterSec,
  };
}

export interface RateLimitOptions {
  routeId: string;
  limit: number;
  windowMs: number;
  failClosed?: boolean; // Auth, invite, billing: true (503). Reads: false (fail-open)
  keyGenerator?: (c: any) => string;
}

/**
 * Creates a rate limiting middleware.
 */
export function rateLimiter(options: RateLimitOptions) {
  const { routeId, limit, windowMs, failClosed = false } = options;

  return createMiddleware(async (c, next) => {
    // If LOADTEST_MODE is enabled or running general unit tests without explicit rate limit testing
    const isEnforcedInTest = c.req.header('x-enforce-rate-limit') === 'true';
    const isTest = process.env.NODE_ENV === 'test' && !isEnforcedInTest;
    const isLoadTest =
      process.env.LOADTEST_MODE === 'true' && process.env.NODE_ENV !== 'production';

    const effectiveLimit = isTest || isLoadTest ? limit * 500 : limit;

    // Resolve client identifier (IP or user ID)
    let identifier: string;
    if (options.keyGenerator) {
      identifier = options.keyGenerator(c);
    } else {
      const forwarded = c.req.header('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
      const userId = c.get('userId' as any);
      identifier = userId ? `u:${userId}` : `ip:${ip}`;
    }

    const key = `rl:${routeId}:${identifier}`;

    try {
      const result = await hitRateLimit(key, effectiveLimit, windowMs);

      c.header('X-RateLimit-Limit', effectiveLimit.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());

      if (!result.allowed) {
        c.header('Retry-After', result.retryAfterSec.toString());
        return c.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              retryAfterSec: result.retryAfterSec,
            },
          },
          429
        );
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, key, routeId }, 'Redis rate limiter execution failure');

      if (failClosed) {
        // Rule 01 & skill: sensitive routes fail closed (503)
        return c.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Rate limiting service unavailable; request rejected for security',
            },
          },
          503
        );
      }
      // Read routes fail open with logged warning
    }

    await next();
  });
}
