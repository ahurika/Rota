import { describe, it, expect, vi } from 'vitest';
import { app } from '../../src/app.js';
import { notificationService } from '../../src/services/notifications/notificationService.js';

describe('Shift Swaps End-to-End Flow and Notifications', () => {
  const timestamp = Date.now();
  const ownerEmail = `owner_swaps_${timestamp}@example.com`;
  const staffEmail = `staff_swaps_${timestamp}@example.com`;
  const targetEmail = `target_swaps_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  it('Allows staff to request swaps, lists swaps via GET, enforces manager approval (rejecting self-approval), reassigns shift, and triggers notifications', async () => {
    // Spy on notificationService
    const notifSpy = vi.spyOn(notificationService, 'processNotification');

    // 1. Register Owner
    const regOwnerRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    expect(regOwnerRes.status).toBe(201);
    const { accessToken: ownerToken, user: ownerUser } = (await regOwnerRes.json()) as any;

    // 2. Owner creates Team
    const createTeamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: 'Swaps Squad' }),
    });
    expect(createTeamRes.status).toBe(201);
    const { team } = (await createTeamRes.json()) as any;
    const teamId = team.id;

    // 3. Register Staff user & Target user
    const regStaffRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staffEmail, password }),
    });
    expect(regStaffRes.status).toBe(201);
    const { accessToken: staffToken, user: staffUser } = (await regStaffRes.json()) as any;

    const regTargetRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password }),
    });
    expect(regTargetRes.status).toBe(201);
    const { accessToken: targetToken, user: targetUser } = (await regTargetRes.json()) as any;

    // 4. Invite both users and accept
    for (const { email, token } of [
      { email: staffEmail, token: staffToken },
      { email: targetEmail, token: targetToken },
    ]) {
      const inviteRes = await app.request(`/v1/teams/${teamId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ email, role: 'staff' }),
      });
      expect(inviteRes.status).toBe(201);
      const { inviteToken } = (await inviteRes.json()) as any;

      const acceptRes = await app.request('/v1/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: inviteToken }),
      });
      expect(acceptRes.status).toBe(200);
    }

    // 5. Owner creates a shift assigned to Staff
    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const endsAt = new Date(Date.now() + 86400000 + 8 * 3600000).toISOString();
    const createShiftRes = await app.request(`/v1/teams/${teamId}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        assigneeId: staffUser.id,
        startsAt,
        endsAt,
        label: 'Opening Barista',
      }),
    });
    expect(createShiftRes.status).toBe(201);
    const { shift } = (await createShiftRes.json()) as any;
    expect(shift.label).toBe('Opening Barista');

    // Notification for shift creation should have been triggered for assignee
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'shift_changes',
        recipients: [staffUser.id],
      })
    );

    // 6. Staff requests a swap for this shift targeting Target user
    const swapReqRes = await app.request(`/v1/teams/${teamId}/swaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        shiftId: shift.id,
        targetId: targetUser.id,
      }),
    });
    expect(swapReqRes.status).toBe(201);
    const { swap } = (await swapReqRes.json()) as any;
    expect(swap.status).toBe('pending');

    // Notification for swap request triggered
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'swaps',
        title: 'Shift Swap Requested',
      })
    );

    // 7. GET /v1/teams/:teamId/swaps lists the swap with shift details and requester email
    const listSwapsRes = await app.request(`/v1/teams/${teamId}/swaps`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });
    expect(listSwapsRes.status).toBe(200);
    const { swaps } = (await listSwapsRes.json()) as any;
    expect(swaps).toBeInstanceOf(Array);
    expect(swaps.length).toBeGreaterThanOrEqual(1);

    const foundSwap = swaps.find((s: any) => s.id === swap.id);
    expect(foundSwap).toBeDefined();
    expect(foundSwap.shift_label).toBe('Opening Barista');
    expect(foundSwap.requester_email).toBe(staffEmail.toLowerCase());
    expect(foundSwap.target_email).toBe(targetEmail.toLowerCase());

    // 8. Staff attempts to approve their own swap -> 403 FORBIDDEN
    const selfApproveRes = await app.request(`/v1/teams/${teamId}/swaps/${swap.id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    // Staff lacks swap.decide permission -> 403
    expect(selfApproveRes.status).toBe(403);

    // 9. Owner approves the swap -> 200 OK
    const ownerApproveRes = await app.request(`/v1/teams/${teamId}/swaps/${swap.id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(ownerApproveRes.status).toBe(200);
    const { swap: approvedSwap } = (await ownerApproveRes.json()) as any;
    expect(approvedSwap.status).toBe('approved');

    // 10. Verify shift is now reassigned to targetUser
    const shiftCheckRes = await app.request(`/v1/teams/${teamId}/shifts/${shift.id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(shiftCheckRes.status).toBe(200);
    const { shift: updatedShift } = (await shiftCheckRes.json()) as any;
    expect(updatedShift.assignee_id).toBe(targetUser.id);

    // Notification for swap decision triggered
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'swaps',
        title: 'Shift Swap Approved',
        recipients: expect.arrayContaining([staffUser.id]),
      })
    );

    notifSpy.mockRestore();
  });
});
