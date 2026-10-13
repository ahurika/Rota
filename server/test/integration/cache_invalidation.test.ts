import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { getRedisClient } from '../../src/db/shards.js';
import { getTeamVersion, bumpTeamVersion } from '../../src/lib/cache.js';

describe('Redis Cache Invalidation & Versioning', () => {
  const timestamp = Date.now();
  const ownerEmail = `owner_cache_${timestamp}@example.com`;
  const password = 'Password123!Secure';
  const redis = getRedisClient();

  it('Cache-aside: version counter bumps on shift mutation, isolating versions cleanly', async () => {
    // 1. Register owner & create team
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken } = (await regRes.json()) as any;

    const teamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: 'Cache Test Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    // 2. Initial team version is 1 or greater
    const initialVer = await getTeamVersion(teamId);
    expect(initialVer).toBeGreaterThanOrEqual(1);

    // 3. Create a shift -> triggers bumpTeamVersion
    const shiftRes = await app.request(`/v1/teams/${teamId}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 90000000).toISOString(),
        label: 'Cached Morning Shift',
      }),
    });
    expect(shiftRes.status).toBe(201);
    const { shift } = (await shiftRes.json()) as any;

    const verAfterCreate = await getTeamVersion(teamId);
    expect(verAfterCreate).toBeGreaterThan(initialVer);

    // 4. Query calendar -> populates Redis key cal:{teamId}:v{ver}:...
    const calRes1 = await app.request(`/v1/teams/${teamId}/shifts`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(calRes1.status).toBe(200);

    // Verify key exists in Redis
    const calKey = `cal:${teamId}:v${verAfterCreate}:all:all`;
    const cachedData = await redis.get(calKey);
    expect(cachedData).not.toBeNull();
    const parsed = JSON.parse(cachedData!);
    expect(parsed.length).toBe(1);
    expect(parsed[0].label).toBe('Cached Morning Shift');

    // 5. Update shift -> bumps version again, invalidating old key
    const updateRes = await app.request(`/v1/teams/${teamId}/shifts/${shift.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ label: 'Updated Evening Shift' }),
    });
    expect(updateRes.status).toBe(200);

    const verAfterUpdate = await getTeamVersion(teamId);
    expect(verAfterUpdate).toBeGreaterThan(verAfterCreate);

    // Query calendar again -> served with updated label under new version key
    const calRes2 = await app.request(`/v1/teams/${teamId}/shifts`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(calRes2.status).toBe(200);
    const { shifts: shifts2 } = (await calRes2.json()) as any;
    expect(shifts2[0].label).toBe('Updated Evening Shift');

    // New version key now exists in Redis
    const newCalKey = `cal:${teamId}:v${verAfterUpdate}:all:all`;
    const newCachedData = await redis.get(newCalKey);
    expect(newCachedData).not.toBeNull();
  });
});
