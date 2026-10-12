import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { dbForTeam } from '../../src/db/shards.js';

describe('Proof Test T8: Seat Caps and Concurrency Enforcement on Starter Teams', () => {
  const timestamp = Date.now();
  const password = 'Password123!Secure';

  it('T8: Starter team cannot exceed 5 seats; 6th invite returns 409 and concurrent invites are strictly serialized', async () => {
    // ==========================================
    // Part 1: Basic Cap Enforcement (5 seats max)
    // ==========================================
    const ownerEmail = `owner_t8_${timestamp}@example.com`;
    const regOwnerRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    expect(regOwnerRes.status).toBe(201);
    const { accessToken: ownerToken } = (await regOwnerRes.json()) as any;

    const teamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: 'Scale Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    // Currently 1 active seat (Owner).
    // Send 4 valid invites to reach the 5-seat cap (1 member + 4 pending invites = 5 occupied seats).
    for (let i = 1; i <= 4; i++) {
      const inviteRes = await app.request(`/v1/teams/${teamId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          email: `invitee_${i}_${timestamp}@example.com`,
          role: 'staff',
        }),
      });
      expect(inviteRes.status).toBe(201);
    }

    // Attempt to send 5th invite (which would be seat 6) -> Must fail with 409 SEAT_LIMIT_REACHED
    const overflowInviteRes = await app.request(`/v1/teams/${teamId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        email: `overflow_${timestamp}@example.com`,
        role: 'staff',
      }),
    });
    expect(overflowInviteRes.status).toBe(409);
    const overflowBody = (await overflowInviteRes.json()) as any;
    expect(overflowBody.error.code).toBe('SEAT_LIMIT_REACHED');

    // ==========================================
    // Part 2: Old Invite Acceptance Rejection When Seats Full
    // ==========================================
    // Setup: Team with 4 members + 1 invite token. Member 5 accepts -> team has 5 active members.
    // An older invite token must fail to be accepted if active members >= 5.
    const fullTeamOwnerEmail = `full_owner_t8_${timestamp}@example.com`;
    const regFullOwnerRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fullTeamOwnerEmail, password }),
    });
    const { accessToken: fullOwnerToken } = (await regFullOwnerRes.json()) as any;

    const fullTeamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fullOwnerToken}`,
      },
      body: JSON.stringify({ name: 'Full House Team' }),
    });
    const { team: fullTeam } = (await fullTeamRes.json()) as any;
    const fullTeamId = fullTeam.id;

    // Send 2 invites while team has 1 member
    const inv1Res = await app.request(`/v1/teams/${fullTeamId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fullOwnerToken}`,
      },
      body: JSON.stringify({ email: `accepted_member_${timestamp}@example.com`, role: 'staff' }),
    });
    const { inviteToken: invToken1 } = (await inv1Res.json()) as any;

    // Directly insert 4 more active members directly in DB to simulate 5 active members
    const poolFull = await dbForTeam(fullTeamId);
    for (let k = 1; k <= 4; k++) {
      const dummyUserId = `00000000-0000-0000-0000-${String(k).padStart(12, '0')}`;
      await poolFull.query(
        `INSERT INTO memberships (team_id, user_id, role, status) VALUES ($1, $2, 'staff', 'active')`,
        [fullTeamId, dummyUserId]
      );
    }
    // Now team has 5 active members (owner + 4 dummy members)

    // Register a real user to accept invToken1
    const lateUserEmail = `late_user_${timestamp}@example.com`;
    const lateUserRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lateUserEmail, password }),
    });
    const { accessToken: lateUserToken } = (await lateUserRes.json()) as any;

    const lateAcceptRes = await app.request('/v1/invites/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lateUserToken}`,
      },
      body: JSON.stringify({ token: invToken1 }),
    });
    expect(lateAcceptRes.status).toBe(409);
    const lateAcceptBody = (await lateAcceptRes.json()) as any;
    expect(lateAcceptBody.error.code).toBe('SEAT_LIMIT_REACHED');

    // ==========================================
    // Part 3: Concurrent Invite Race Condition (Row-Level Locking)
    // ==========================================
    // Setup a new team with 4 seats occupied (1 owner + 3 pending invites).
    // Exactly 1 seat remains open under the 5-seat cap.
    const raceOwnerEmail = `race_owner_t8_${timestamp}@example.com`;
    const regRaceOwnerRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: raceOwnerEmail, password }),
    });
    const { accessToken: raceOwnerToken } = (await regRaceOwnerRes.json()) as any;

    const raceTeamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${raceOwnerToken}`,
      },
      body: JSON.stringify({ name: 'Race Condition Team' }),
    });
    const { team: raceTeam } = (await raceTeamRes.json()) as any;
    const raceTeamId = raceTeam.id;

    // Fill 3 seats with invites (1 member + 3 invites = 4 occupied)
    for (let j = 1; j <= 3; j++) {
      const invRes = await app.request(`/v1/teams/${raceTeamId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${raceOwnerToken}`,
        },
        body: JSON.stringify({ email: `race_fill_${j}_${timestamp}@example.com`, role: 'staff' }),
      });
      expect(invRes.status).toBe(201);
    }

    // Now 4 seats are occupied, 1 seat remains.
    // Fire two simultaneous invite requests.
    const [resA, resB] = await Promise.all([
      app.request(`/v1/teams/${raceTeamId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${raceOwnerToken}`,
        },
        body: JSON.stringify({ email: `contestant_a_${timestamp}@example.com`, role: 'staff' }),
      }),
      app.request(`/v1/teams/${raceTeamId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${raceOwnerToken}`,
        },
        body: JSON.stringify({ email: `contestant_b_${timestamp}@example.com`, role: 'staff' }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one must succeed (201) and one must be rejected (409)
    expect(statuses).toEqual([201, 409]);

    // Verify in database: total pending invites is exactly 4 (so total seats = 1 owner + 4 invites = 5)
    const racePool = await dbForTeam(raceTeamId);
    const inviteCountRes = await racePool.query(
      `SELECT COUNT(*) as count FROM invites WHERE team_id = $1 AND status = 'pending'`,
      [raceTeamId]
    );
    expect(parseInt(inviteCountRes.rows[0].count, 10)).toBe(4);
  });
});
