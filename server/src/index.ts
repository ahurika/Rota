import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { ensureRedisServer } from './db/redisServer.js';

await ensureRedisServer();

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    logger.info(`Server running on http://localhost:${info.port} in ${env.NODE_ENV} mode (cache: ${process.env.FEED_CACHE_ENABLED})`);
  }
);
