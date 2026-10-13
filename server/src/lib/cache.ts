import { getRedisClient } from '../db/shards.js';
import { logger } from './logger.js';
import { env } from '../config/env.js';

export const TTL = {
  ROSTER: 300, // 300 seconds
  CALENDAR: 60, // 60 seconds
  FEED: 15, // 15 seconds
} as const;

/**
 * Returns current team version counter.
 * Defaults to 1 if unset.
 */
export async function getTeamVersion(teamId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const ver = await redis.get(`teamver:${teamId}`);
    return ver ? parseInt(ver, 10) : 1;
  } catch (err: any) {
    logger.warn({ err: err?.message, teamId }, 'Failed to read teamver from Redis; defaulting to 1');
    return 1;
  }
}

/**
 * Explicit invalidation: increments teamver counter.
 * Any key embedding `v{ver}` will immediately be orphaned and expire naturally.
 */
export async function bumpTeamVersion(teamId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const next = await redis.incr(`teamver:${teamId}`);
    return next;
  } catch (err: any) {
    logger.warn({ err: err?.message, teamId }, 'Failed to bump teamver in Redis');
    return 1;
  }
}

/**
 * Standard cache-aside reader.
 * On Redis failure, falls through to loader with a warning (app stays correct, just slower).
 */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  try {
    const redis = getRedisClient();
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, key }, 'Cache read failed; falling through to loader');
  }

  const fresh = await load();

  try {
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec);
  } catch (err: any) {
    logger.warn({ err: err?.message, key }, 'Cache write failed');
  }

  return fresh;
}

/**
 * Feed cache with stampede lock protection (mutex refilling).
 * Guarded by FEED_CACHE_ENABLED.
 */
export async function getCachedFeed<T>(
  teamId: string,
  cursor: string | null,
  limit: number,
  loader: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  // If feed caching is disabled via env flag, bypass cache completely
  if (env.FEED_CACHE_ENABLED === false || process.env.FEED_CACHE_ENABLED === 'false') {
    const data = await loader();
    return { data, cached: false };
  }

  const ver = await getTeamVersion(teamId);
  const cacheKey = `feed:${teamId}:v${ver}:${cursor || 'first'}:${limit}`;

  try {
    const redis = getRedisClient();
    const hit = await redis.get(cacheKey);
    if (hit !== null) {
      return { data: JSON.parse(hit) as T, cached: true };
    }

    // Stampede mutex lock for first page
    const lockKey = `lock:${cacheKey}`;
    const acquired = await redis.set(lockKey, '1', 'EX', 5, 'NX');

    if (acquired) {
      try {
        const fresh = await loader();
        await redis.set(cacheKey, JSON.stringify(fresh), 'EX', TTL.FEED);
        return { data: fresh, cached: false };
      } finally {
        await redis.del(lockKey).catch(() => {});
      }
    } else {
      // Another worker is refilling the cache: wait 50ms and check once more
      await new Promise((r) => setTimeout(r, 50));
      const retryHit = await redis.get(cacheKey);
      if (retryHit !== null) {
        return { data: JSON.parse(retryHit) as T, cached: true };
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, cacheKey }, 'Feed cache lookup error; falling through to loader');
  }

  const fresh = await loader();
  return { data: fresh, cached: false };
}
