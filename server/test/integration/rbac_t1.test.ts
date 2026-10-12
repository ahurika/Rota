import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { dbForTeam } from '../../src/db/shards.js';

describe('Proof Test T1: RBAC Enforcement - Staff Cannot Delete Shift', () => {
  const timestamp = Date.now();
  const ownerEmail = `owner_t1_${timestamp}@example.com`;
  const staffEmail = `staff_t1_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  it('T1: Staff calling DELETE on shift gets 403 FORBIDDEN and shift remains intact in DB', async () => {
    // 1. Register Owner
    const regOwnerRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    expect(regOwnerRes.status).toBe(201);
    const { accessToken: ownerToken } = (await regOwnerRes.json()) as any;

    // 2. Owner creates Team
    const createTeamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: 'Alpha Squad' }),
    });
    expect(createTeamRes.status).toBe(201);
    const { team } = (await createTeamRes.json()) as any;
    const teamId = team.id;

    // 3. Register Staff user
    const regStaffRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staffEmail, password }),
    });
    expect(regStaffRes.status).toBe(201);
    const { accessToken: staffToken } = (await regStaffRes.json()) as any;

    // 4. Owner invites Staff
    const inviteRes = await app.request(`/v1/teams/${teamId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ email: staffEmail, role: 'staff' }),
    });
    expect(inviteRes.status).toBe(201);
    const { inviteToken } = (await inviteRes.json()) as any;

    // 5. Staff accepts the invite
    const acceptRes = await app.request('/v1/invites/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ token: inviteToken }),
    });
    expect(acceptRes.status).toBe(200);

    // 6. Owner creates a Shift
    const shiftStartsAt = new Date(Date.now() + 86400000).toISOString();
    const shiftEndsAt = new Date(Date.now() + 86400000 + 8 * 3600000).toISOString();

    const createShiftRes = await app.request(`/v1/teams/${teamId}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        label: 'Morning Dispatch',
        startsAt: shiftStartsAt,
        endsAt: shiftEndsAt,
      }),
    });
    expect(createShiftRes.status).toBe(201);
    const { shift } = (await createShiftRes.json()) as any;
    const shiftId = shift.id;

    // 7. Verify Staff CAN read the shift (shift.read permission includes staff)
    const readShiftRes = await app.request(`/v1/teams/${teamId}/shifts/${shiftId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });
    expect(readShiftRes.status).toBe(200);

    // 8. CRITICAL PROOF TEST: Staff calls DELETE /v1/teams/:teamId/shifts/:shiftId
    const deleteRes = await app.request(`/v1/teams/${teamId}/shifts/${shiftId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    expect(deleteRes.status).toBe(403);
    const deleteBody = (await deleteRes.json()) as any;
    expect(deleteBody.error.code).toBe('FORBIDDEN');
    expect(deleteBody.error.message).toMatch(/permission/i);

    // 9. Query shard DB directly to assert the shift still exists
    const pool = await dbForTeam(teamId);
    const dbShiftCheck = await pool.query(
      'SELECT id, team_id, label FROM shifts WHERE id = $1 AND team_id = $2',
      [shiftId, teamId]
    );
    expect(dbShiftCheck.rows.length).toBe(1);
    expect(dbShiftCheck.rows[0].label).toBe('Morning Dispatch');

    // 10. Owner successfully deletes the shift
    const ownerDeleteRes = await app.request(`/v1/teams/${teamId}/shifts/${shiftId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(ownerDeleteRes.status).toBe(200);

    // Verify it is now deleted in DB
    const dbShiftCheckAfter = await pool.query(
      'SELECT id FROM shifts WHERE id = $1 AND team_id = $2',
      [shiftId, teamId]
    );
    expect(dbShiftCheckAfter.rows.length).toBe(0);
  });
});
