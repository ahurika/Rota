import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { activityRepository } from '../../src/repositories/activityRepository.js';

describe('Proof Test T9: Activity Feed Cursor Pagination with Concurrent Inserts', () => {
  const timestamp = Date.now();
  const ownerEmail = `owner_t9_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  it('T9: Cursor pagination prevents skips and repeats under concurrent insertions and timestamp ties', async () => {
    // 1. Setup Owner and Team
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken: ownerToken, user: ownerUser } = (await regRes.json()) as any;

    const teamRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: 'Feed Alpha Team' }),
    });
    expect(teamRes.status).toBe(201);
    const { team } = (await teamRes.json()) as any;
    const teamId = team.id;

    // 2. Insert 60 baseline events with deliberate timestamp ties
    // Base timestamp in the past
    const baseTime = new Date('2026-10-01T12:00:00.000Z').getTime();
    const originalEventIds: string[] = [];

    // Create events from oldest to newest or in batches with identical timestamps
    // We create 20 distinct timestamp buckets with 3 events each = 60 events total
    for (let bucket = 0; bucket < 20; bucket++) {
      const bucketTime = new Date(baseTime + bucket * 1000); // 1-second intervals
      for (let item = 0; item < 3; item++) {
        const ev = await activityRepository.createEvent({
          teamId,
          type: 'shift_created',
          actorId: ownerUser.id,
          payload: { bucket, item, label: `Event B${bucket} I${item}` },
          createdAt: bucketTime, // Exact tie for all 3 items in the bucket
        });
        originalEventIds.push(ev.id);
      }
    }
    expect(originalEventIds.length).toBe(60);

    // 3. Fetch Page 1 (limit 20)
    const page1Res = await app.request(`/v1/teams/${teamId}/activity?limit=20`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(page1Res.status).toBe(200);
    const page1Data = (await page1Res.json()) as any;
    expect(page1Data.items.length).toBe(20);
    expect(page1Data.hasMore).toBe(true);
    expect(page1Data.nextCursor).toBeTruthy();

    const cursor1 = page1Data.nextCursor;

    // 4. CONCURRENT INSERTION: While the user is reading page 1, insert 3 brand new events
    // with timestamps newer than any of the 60 events!
    const newerTime = new Date(baseTime + 100000);
    for (let n = 1; n <= 3; n++) {
      await activityRepository.createEvent({
        teamId,
        type: 'shift_created',
        actorId: ownerUser.id,
        payload: { label: `New Incoming Event ${n}` },
        createdAt: newerTime,
      });
    }

    // 5. Fetch Page 2 using cursor from Page 1 (limit 20)
    const page2Res = await app.request(
      `/v1/teams/${teamId}/activity?cursor=${encodeURIComponent(cursor1)}&limit=20`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    expect(page2Res.status).toBe(200);
    const page2Data = (await page2Res.json()) as any;
    expect(page2Data.items.length).toBe(20);
    expect(page2Data.hasMore).toBe(true);
    expect(page2Data.nextCursor).toBeTruthy();

    const cursor2 = page2Data.nextCursor;

    // 6. Fetch Page 3 using cursor from Page 2 (limit 20)
    const page3Res = await app.request(
      `/v1/teams/${teamId}/activity?cursor=${encodeURIComponent(cursor2)}&limit=20`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    expect(page3Res.status).toBe(200);
    const page3Data = (await page3Res.json()) as any;
    expect(page3Data.items.length).toBe(20);
    // All 60 original events have now been fetched: exactly 20 items and no 21st item exists
    expect(page3Data.hasMore).toBe(false);
    expect(page3Data.nextCursor).toBeNull();

    // 7. ASSERTIONS FOR T9:
    const allSeenItems = [...page1Data.items, ...page2Data.items, ...page3Data.items];
    expect(allSeenItems.length).toBe(60);

    const seenIds = allSeenItems.map((e) => e.id);
    const uniqueIds = new Set(seenIds);

    // Assert: No ID appears twice (NO REPEATS)
    expect(uniqueIds.size).toBe(60);

    // Assert: Every ID from original 60 is present (NO SKIPS despite 3 new events added at top)
    for (const origId of originalEventIds) {
      expect(uniqueIds.has(origId)).toBe(true);
    }

    // Assert: Strict descending order by (created_at DESC, id DESC)
    for (let i = 0; i < allSeenItems.length - 1; i++) {
      const cur = allSeenItems[i];
      const next = allSeenItems[i + 1];

      const curTime = new Date(cur.created_at).getTime();
      const nextTime = new Date(next.created_at).getTime();

      if (curTime === nextTime) {
        // When timestamps tie, ID must break the tie descending
        expect(BigInt(cur.id) > BigInt(next.id)).toBe(true);
      } else {
        expect(curTime > nextTime).toBe(true);
      }
    }

    // 8. Invalid cursor returns 400 INVALID_CURSOR
    const badCursorRes = await app.request(
      `/v1/teams/${teamId}/activity?cursor=invalid_base64_garbage`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    expect(badCursorRes.status).toBe(400);
    const badBody = (await badCursorRes.json()) as any;
    expect(badBody.error.code).toBe('INVALID_CURSOR');

    // 9. Team isolation with cursor: Team B cannot see Team A items even if using Team A cursor
    const ownerBEmail = `owner_b_t9_${timestamp}@example.com`;
    const regBRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerBEmail, password }),
    });
    const { accessToken: tokenB } = (await regBRes.json()) as any;

    const teamBRes = await app.request('/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Feed Bravo Team' }),
    });
    const { team: teamB } = (await teamBRes.json()) as any;

    const teamBFeedRes = await app.request(
      `/v1/teams/${teamB.id}/activity?cursor=${encodeURIComponent(cursor1)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    expect(teamBFeedRes.status).toBe(200);
    const teamBFeed = (await teamBFeedRes.json()) as any;
    expect(teamBFeed.items.length).toBe(0);
  });
});
