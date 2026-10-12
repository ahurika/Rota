import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { dbForTeam } from '../../src/db/shards.js';

describe('Proof Test T2: Multi-Tenant Isolation - Cross-Team Requests Return 404', () => {
  const timestamp = Date.now();
  const ownerAEmail = `owner_t2_a_${timestamp}@example.com`;
  const ownerBEmail = `owner_t2_b_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  it('T2: User from Team A receives 404 for Team B resources, preventing enumeration and modification', async () => {
    // 1. Setup Team A and Shift A
    const regARes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerAEmail, password }),
    });
    expect(regARes.status).toBe(201);
    const { accessToken: tokenA } = (await regARes.json()) as any;

    const teamARes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Team Alpha' }),
    });
    expect(teamARes.status).toBe(201);
    const { team: teamA } = (await teamARes.json()) as any;
    const teamIdA = teamA.id;

    const shiftARes = await app.request(`/v1/teams/${teamIdA}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        label: 'Shift A Alpha',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000 + 4 * 3600000).toISOString(),
      }),
    });
    expect(shiftARes.status).toBe(201);
    const { shift: shiftA } = (await shiftARes.json()) as any;
    const shiftIdA = shiftA.id;

    // 2. Setup Team B and Shift B
    const regBRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerBEmail, password }),
    });
    expect(regBRes.status).toBe(201);
    const { accessToken: tokenB } = (await regBRes.json()) as any;

    const teamBRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Team Bravo' }),
    });
    expect(teamBRes.status).toBe(201);
    const { team: teamB } = (await teamBRes.json()) as any;
    const teamIdB = teamB.id;

    const shiftBRes = await app.request(`/v1/teams/${teamIdB}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        label: 'Shift B Bravo Secret Data',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000 + 4 * 3600000).toISOString(),
      }),
    });
    expect(shiftBRes.status).toBe(201);
    const { shift: shiftB } = (await shiftBRes.json()) as any;
    const shiftIdB = shiftB.id;

    // 3. Attack Step 1: User A calls GET /v1/teams/:teamIdB/shifts
    // Expect 404 NOT_FOUND (Rule 01: loadMembership returns 404 to avoid enumeration)
    const listBWithARes = await app.request(`/v1/teams/${teamIdB}/shifts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(listBWithARes.status).toBe(404);
    const listBBody = (await listBWithARes.json()) as any;
    expect(listBBody.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(listBBody)).not.toContain('Shift B Bravo Secret Data');

    // 4. Attack Step 2: User A calls GET /v1/teams/:teamIdA/shifts/:shiftIdB
    // Querying team A for a shift belonging to Team B
    const getShiftBInARes = await app.request(`/v1/teams/${teamIdA}/shifts/${shiftIdB}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(getShiftBInARes.status).toBe(404);
    const getShiftBBody = (await getShiftBInARes.json()) as any;
    expect(getShiftBBody.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(getShiftBBody)).not.toContain('Shift B Bravo Secret Data');

    // 5. Attack Step 3: User A tries PATCH on shiftIdB inside team A
    const patchShiftBInARes = await app.request(`/v1/teams/${teamIdA}/shifts/${shiftIdB}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ label: 'Tampered Shift Label' }),
    });
    expect(patchShiftBInARes.status).toBe(404);

    // 6. Attack Step 4: User A tries DELETE on shiftIdB inside team A
    const deleteShiftBInARes = await app.request(`/v1/teams/${teamIdA}/shifts/${shiftIdB}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(deleteShiftBInARes.status).toBe(404);

    // 7. Attack Step 5: User A tries DELETE on shiftIdB directly targeting team B route
    const deleteShiftBInBRes = await app.request(`/v1/teams/${teamIdB}/shifts/${shiftIdB}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(deleteShiftBInBRes.status).toBe(404);

    // 8. Direct DB check on Team B shard: verify Shift B is completely intact and unchanged
    const poolB = await dbForTeam(teamIdB);
    const dbShiftBCheck = await poolB.query(
      'SELECT id, team_id, label FROM shifts WHERE id = $1 AND team_id = $2',
      [shiftIdB, teamIdB]
    );
    expect(dbShiftBCheck.rows.length).toBe(1);
    expect(dbShiftBCheck.rows[0].label).toBe('Shift B Bravo Secret Data');
  });
});
