import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimiter } from '../../src/lib/rateLimit.js';
import { getRedisClient } from '../../src/db/shards.js';

describe('Proof Test T13: Redis Rate Limiting & Window Reset', () => {
  const redis = getRedisClient();

  beforeEach(async () => {
    // Clean up test keys
    const keys = await redis.keys('rl:t13:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it('T13: Enforces limit of 5, rejects 6th with 429 + Retry-After, and allows again after window resets', async () => {
    // Setup a test app with strict 5 requests per 1000ms window
    const testApp = new Hono();
    testApp.get(
      '/limited',
      rateLimiter({
        routeId: 't13_route',
        limit: 5,
        windowMs: 1200, // 1.2 second window
        failClosed: true,
        keyGenerator: (c) => c.req.header('x-test-ip') || '192.168.1.100',
      }),
      (c) => c.json({ ok: true, count: 'success' }, 200)
    );

    const testIp = `192.168.1.${Date.now() % 250}`;

    // 1. Send 5 requests -> all must succeed (200 OK)
    for (let i = 1; i <= 5; i++) {
      const res = await testApp.request('/limited', {
        method: 'GET',
        headers: {
          'x-test-ip': testIp,
          'x-enforce-rate-limit': 'true',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-ratelimit-remaining')).toBe((5 - i).toString());
    }

    // 2. Send 6th request -> must be rejected with 429
    const blockedRes = await testApp.request('/limited', {
      method: 'GET',
      headers: {
        'x-test-ip': testIp,
        'x-enforce-rate-limit': 'true',
      },
    });

    expect(blockedRes.status).toBe(429);
    const retryAfter = blockedRes.headers.get('retry-after');
    expect(retryAfter).toBeTruthy();
    expect(parseInt(retryAfter!, 10)).toBeGreaterThanOrEqual(1);

    const blockedBody = (await blockedRes.json()) as any;
    expect(blockedBody.error.code).toBe('RATE_LIMIT_EXCEEDED');

    // 3. Wait for window to reset (1300ms)
    await new Promise((resolve) => setTimeout(resolve, 1300));

    // 4. Send 7th request -> window has reset, request must succeed (200 OK)!
    const resetRes = await testApp.request('/limited', {
      method: 'GET',
      headers: {
        'x-test-ip': testIp,
        'x-enforce-rate-limit': 'true',
      },
    });

    expect(resetRes.status).toBe(200);
    expect(resetRes.headers.get('x-ratelimit-remaining')).toBe('4');
  });

  it('T13: Different client identifiers maintain completely independent rate limit counters', async () => {
    const testApp = new Hono();
    testApp.get(
      '/limited',
      rateLimiter({
        routeId: 't13_route',
        limit: 2,
        windowMs: 5000,
        failClosed: true,
        keyGenerator: (c) => c.req.header('x-test-ip')!,
      }),
      (c) => c.json({ ok: true }, 200)
    );

    const clientA = '10.0.0.1';
    const clientB = '10.0.0.2';

    // Exhaust client A's quota
    await testApp.request('/limited', { headers: { 'x-test-ip': clientA, 'x-enforce-rate-limit': 'true' } });
    await testApp.request('/limited', { headers: { 'x-test-ip': clientA, 'x-enforce-rate-limit': 'true' } });
    const blockedA = await testApp.request('/limited', { headers: { 'x-test-ip': clientA, 'x-enforce-rate-limit': 'true' } });
    expect(blockedA.status).toBe(429);

    // Client B should still have full quota
    const resB = await testApp.request('/limited', { headers: { 'x-test-ip': clientB, 'x-enforce-rate-limit': 'true' } });
    expect(resB.status).toBe(200);
    expect(resB.headers.get('x-ratelimit-remaining')).toBe('1');
  });
});
