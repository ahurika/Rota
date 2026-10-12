import { createHash } from 'node:crypto';
import pg from 'pg';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

export const SHARD_COUNT = 2;

/**
 * Deterministically computes the shard index (0 or 1) for a team.
 * Formula: first 4 bytes of sha256(team_id) as an unsigned big-endian integer, modulo SHARD_COUNT.
 * Source of truth: PRD.md Section 8.3 and shard-router-and-db-routing skill.
 */
export function hashShard(teamId: string): number {
  const hashBuffer = createHash('sha256').update(teamId).digest();
  const first4 = hashBuffer.readUInt32BE(0);
  return first4 % SHARD_COUNT;
}

// Connection pool configuration per ADR-003 and backend standards
const poolConfig: pg.PoolConfig = {
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
};

// Shard primary pools
export const primaryPool0 = new Pool({
  connectionString: env.DATABASE_URL_0,
  ...poolConfig,
});

export const primaryPool1 = new Pool({
  connectionString: env.DATABASE_URL_1,
  ...poolConfig,
});

// Read replica pools (fall back to primary URLs if not specified)
export const readPool0 = new Pool({
  connectionString: env.DATABASE_URL_READ_0 || env.DATABASE_URL_0,
  ...poolConfig,
});

export const readPool1 = new Pool({
  connectionString: env.DATABASE_URL_READ_1 || env.DATABASE_URL_1,
  ...poolConfig,
});

// Redis client for read-your-own-writes and caching
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 500,
      retryStrategy: () => null,
    });
    redisClient.on('error', (err: Error) => {
      logger.warn({ err: err.message }, 'Redis client connection error (falling back to primary)');
    });
  }
  return redisClient;
}

/**
 * Returns the primary pool for a shard index.
 */
export function primary(shard: number): pg.Pool {
  return shard === 0 ? primaryPool0 : primaryPool1;
}

/**
 * Returns the read pool for a shard index.
 */
export function replica(shard: number): pg.Pool {
  return shard === 0 ? readPool0 : readPool1;
}

/**
 * Resolves the shard for a team, checking for enterprise overrides in database 0.
 */
export async function shardFor(teamId: string): Promise<number> {
  try {
    const res = await primaryPool0.query<{ shard: number }>(
      'SELECT shard FROM team_shard_overrides WHERE team_id = $1 LIMIT 1',
      [teamId]
    );
    if (res.rows.length > 0) {
      return res.rows[0].shard;
    }
  } catch {
    // If table doesn't exist yet or query fails, fall through to hash
  }
  return hashShard(teamId);
}

/**
 * Database client for writes scoped to a team. Always hits the primary database.
 */
export async function dbForTeam(teamId: string): Promise<pg.Pool> {
  const shard = await shardFor(teamId);
  return primary(shard);
}

/**
 * Database client for reads scoped to a team.
 * Enforces the 5-second read-your-own-writes rule:
 * If the user recently performed a write (checked via Redis), routes to the primary.
 * If Redis is unavailable or expired, routes to the read replica.
 */
export async function dbForRead(teamId: string, userId?: string): Promise<pg.Pool> {
  const shard = await shardFor(teamId);
  if (!userId) {
    return replica(shard);
  }

  try {
    const redis = getRedisClient();
    const hasRecentWrite = await redis.exists(`recent_write:${userId}`);
    if (hasRecentWrite) {
      return primary(shard);
    }
  } catch {
    // Redis down: reading from primary is the safe choice to guarantee correctness
    return primary(shard);
  }

  return replica(shard);
}

/**
 * Marks a write by a user so their subsequent reads within 5 seconds hit the primary.
 */
export async function markWrite(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(`recent_write:${userId}`, '1', 'EX', 5);
  } catch (err) {
    // Non-fatal if Redis fails: dbForRead fails safe to primary
    logger.warn({ userId, err }, 'Failed to record recent_write in Redis');
  }
}
