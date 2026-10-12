import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { hashShard } from '../../src/db/shards.js';

describe('Shard Router Unit Tests', () => {
  it('hashShard is deterministic for identical input', () => {
    const teamId = 'a4b868e6-1234-4567-89ab-cdef01234567';
    const first = hashShard(teamId);
    for (let i = 0; i < 50; i++) {
      expect(hashShard(teamId)).toBe(first);
    }
  });

  it('hashShard distributes 1,000 UUIDs roughly evenly across 2 shards', () => {
    let shard0Count = 0;
    let shard1Count = 0;

    for (let i = 0; i < 1000; i++) {
      const id = uuidv4();
      const shard = hashShard(id);
      expect(shard === 0 || shard === 1).toBe(true);
      if (shard === 0) shard0Count++;
      else shard1Count++;
    }

    // Both shards should receive between 40% (400) and 60% (600) of keys
    expect(shard0Count).toBeGreaterThanOrEqual(400);
    expect(shard0Count).toBeLessThanOrEqual(600);
    expect(shard1Count).toBeGreaterThanOrEqual(400);
    expect(shard1Count).toBeLessThanOrEqual(600);
  });
});
