import { RedisMemoryServer } from 'redis-memory-server';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

let memoryServer: RedisMemoryServer | null = null;

/**
 * Ensures a Redis instance is available on port 6380 for local development and test runs.
 * If an external Redis instance is already listening on port 6380, it leaves it alone.
 */
export async function ensureRedisServer(): Promise<void> {
  if (memoryServer) {
    return;
  }

  // If REDIS_URL points to a remote cloud instance (e.g. Upstash), skip embedded redis
  if (env.REDIS_URL && !env.REDIS_URL.includes('localhost') && !env.REDIS_URL.includes('127.0.0.1')) {
    return;
  }

  try {
    memoryServer = new RedisMemoryServer({
      instance: { port: 6380 },
    });
    await memoryServer.start();
    logger.info({ port: 6380 }, 'Embedded RedisMemoryServer started successfully on port 6380');
  } catch (err: any) {
    // If port 6380 is already in use (e.g. by external redis or docker), that's fine
    logger.debug({ err: err?.message }, 'Redis port 6380 already bound or external server running');
  }
}

// Suppress spurious unhandledRejection emitted by redis-memory-server on Windows when killed
process.on('unhandledRejection', (reason: any) => {
  if (typeof reason === 'string' && reason.includes('redis-server instance closed with code "1"')) {
    return; // expected on process kill under Windows
  }
  if (reason instanceof Error && reason.message.includes('redis-server instance closed with code "1"')) {
    return;
  }
});

export async function stopRedisServer(): Promise<void> {
  if (memoryServer) {
    try {
      await memoryServer.stop();
    } catch {}
    memoryServer = null;
  }
}
