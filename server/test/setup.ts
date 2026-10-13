import { ensureRedisServer } from '../src/db/redisServer.js';

export async function setup() {
  await ensureRedisServer();
}
