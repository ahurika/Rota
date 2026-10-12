import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/app.js';
import { primaryPool0 } from '../../src/db/shards.js';

describe('Proof Test T4: Refresh Token Rotation and Reuse Detection', () => {
  const testEmail = `user_t4_${Date.now()}@example.com`;
  const testPassword = 'Password123!Secure';

  it('T4: Refresh token rotation issues new token, and reusing an old token revokes the entire family', async () => {
    // 1. Register a new user
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const regBody = (await regRes.json()) as any;
    expect(regRes.status).toBe(201);
    expect(regBody).toHaveProperty('accessToken');
    expect(regBody).toHaveProperty('refreshToken');

    const rt1 = regBody.refreshToken;
    const userId = regBody.user.id;

    // Verify token was stored in DB
    const dbCheck1 = await primaryPool0.query(
      'SELECT family_id, used_at, revoked_at FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
    expect(dbCheck1.rows.length).toBe(1);
    const familyId = dbCheck1.rows[0].family_id;
    expect(dbCheck1.rows[0].used_at).toBeNull();
    expect(dbCheck1.rows[0].revoked_at).toBeNull();

    // 2. Normal rotation: use RT1 to get RT2
    const refreshRes1 = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: rt1,
      }),
    });
    expect(refreshRes1.status).toBe(200);
    const refreshBody1 = (await refreshRes1.json()) as any;
    expect(refreshBody1).toHaveProperty('accessToken');
    expect(refreshBody1).toHaveProperty('refreshToken');

    const rt2 = refreshBody1.refreshToken;
    expect(rt2).not.toBe(rt1);

    // Verify in database: RT1 is marked used, RT2 is created under the same family_id
    const dbCheck2 = await primaryPool0.query(
      'SELECT token_hash, used_at, revoked_at, replaced_by FROM refresh_tokens WHERE family_id = $1 ORDER BY created_at ASC',
      [familyId]
    );
    expect(dbCheck2.rows.length).toBe(2);
    expect(dbCheck2.rows[0].used_at).not.toBeNull(); // RT1 used
    expect(dbCheck2.rows[0].replaced_by).not.toBeNull(); // replaced_by points to RT2
    expect(dbCheck2.rows[1].used_at).toBeNull(); // RT2 not used yet
    expect(dbCheck2.rows[1].revoked_at).toBeNull();

    // 3. REUSE ATTACK: Replay RT1 (which is already used)
    const replayRes = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: rt1,
      }),
    });
    expect(replayRes.status).toBe(401);
    const replayBody = (await replayRes.json()) as any;
    expect(replayBody.error.message).toMatch(/reuse detected/i);

    // 4. Verify in database: ALL tokens in the family are now revoked!
    const dbCheck3 = await primaryPool0.query(
      'SELECT token_hash, used_at, revoked_at FROM refresh_tokens WHERE family_id = $1',
      [familyId]
    );
    expect(dbCheck3.rows.length).toBe(2);
    for (const row of dbCheck3.rows) {
      expect(row.revoked_at).not.toBeNull();
    }

    // 5. Verify that RT2 is now also rejected because its family was revoked
    const refreshRes2 = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: rt2,
      }),
    });
    expect(refreshRes2.status).toBe(401);
    const body2 = (await refreshRes2.json()) as any;
    expect(body2.error.message).toMatch(/revoked/i);
  });
});
