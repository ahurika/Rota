import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from '../lib/jwt.js';
import { AppError } from '../lib/errors.js';
import { getRedisClient } from '../db/shards.js';
import { usersRepository } from '../repositories/usersRepository.js';

export const requireAuth = () =>
  createMiddleware(async (c, next) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 401, 'Missing or malformed Authorization header');
    }

    const token = authHeader.substring(7).trim();
    const payload = verifyAccessToken(token);

    // Verify token version against Redis or Database to support immediate logout-all
    let currentTv: number | null = null;
    try {
      const redis = getRedisClient();
      const cachedTv = await redis.get(`tv:${payload.sub}`);
      if (cachedTv !== null) {
        currentTv = parseInt(cachedTv, 10);
      }
    } catch {
      // Redis unavailable: fallback to DB
    }

    if (currentTv === null) {
      const user = await usersRepository.findById(payload.sub);
      if (!user) {
        throw new AppError('UNAUTHORIZED', 401, 'User account no longer exists');
      }
      currentTv = user.token_version;
      try {
        const redis = getRedisClient();
        await redis.set(`tv:${payload.sub}`, currentTv.toString(), 'EX', 3600);
      } catch {}
    }

    if (payload.tv < currentTv) {
      throw new AppError('UNAUTHORIZED', 401, 'Session revoked via logout-all');
    }

    c.set('userId', payload.sub);
    c.set('familyId', payload.sid);

    await next();
  });
