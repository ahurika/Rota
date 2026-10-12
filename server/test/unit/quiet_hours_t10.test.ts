import { describe, it, expect } from 'vitest';
import { nextAllowedTime } from '../../src/lib/quietHours.js';
import { DateTime } from 'luxon';

describe('Proof Test T10: Quiet Hours Calculation Engine', () => {
  it('T10: 02:00 local time in Africa/Lagos is delayed until 06:00 local time', () => {
    // 2026-10-13 01:00 UTC is 02:00 in Africa/Lagos (UTC+1)
    const now = new Date('2026-10-13T01:00:00.000Z');
    const releaseAt = nextAllowedTime(now, 'Africa/Lagos', '22:00', '06:00');

    expect(releaseAt).not.toBeNull();
    // 06:00 in Lagos (UTC+1) is 05:00 UTC on the same day
    expect(releaseAt?.toISOString()).toBe('2026-10-13T05:00:00.000Z');

    const localRelease = DateTime.fromJSDate(releaseAt!, { zone: 'Africa/Lagos' });
    expect(localRelease.hour).toBe(6);
    expect(localRelease.minute).toBe(0);
    expect(localRelease.day).toBe(13);
  });

  it('Delays evening notification (22:30 local) to 06:00 the following morning', () => {
    // 2026-10-12 21:30 UTC is 22:30 in Africa/Lagos (UTC+1)
    const now = new Date('2026-10-12T21:30:00.000Z');
    const releaseAt = nextAllowedTime(now, 'Africa/Lagos', '22:00', '06:00');

    expect(releaseAt).not.toBeNull();
    // Releases at 06:00 Lagos tomorrow morning (05:00 UTC on Oct 13)
    expect(releaseAt?.toISOString()).toBe('2026-10-13T05:00:00.000Z');
  });

  it('Allows immediate sending outside quiet hours (09:00 local)', () => {
    // 2026-10-13 08:00 UTC is 09:00 in Africa/Lagos (UTC+1)
    const now = new Date('2026-10-13T08:00:00.000Z');
    const releaseAt = nextAllowedTime(now, 'Africa/Lagos', '22:00', '06:00');

    expect(releaseAt).toBeNull();
  });

  it('Handles midday non-wrapping quiet hours (13:00 to 15:00)', () => {
    // 2026-10-13 12:30 UTC is 13:30 in Africa/Lagos (UTC+1)
    const now = new Date('2026-10-13T12:30:00.000Z');
    const releaseAt = nextAllowedTime(now, 'Africa/Lagos', '13:00', '15:00');

    expect(releaseAt).not.toBeNull();
    // 15:00 Lagos is 14:00 UTC
    expect(releaseAt?.toISOString()).toBe('2026-10-13T14:00:00.000Z');
  });

  it('Calculates correctly in America/New_York (EDT UTC-4)', () => {
    // 2026-10-13 05:00 UTC is 01:00 in New York
    const now = new Date('2026-10-13T05:00:00.000Z');
    const releaseAt = nextAllowedTime(now, 'America/New_York', '22:00', '06:00');

    expect(releaseAt).not.toBeNull();
    // 06:00 EDT is 10:00 UTC
    expect(releaseAt?.toISOString()).toBe('2026-10-13T10:00:00.000Z');
  });

  it('Returns null when quiet hours are disabled (quietStart === quietEnd)', () => {
    const now = new Date('2026-10-13T01:00:00.000Z');
    expect(nextAllowedTime(now, 'Africa/Lagos', '00:00', '00:00')).toBeNull();
    expect(nextAllowedTime(now, 'America/New_York', '06:00', '06:00')).toBeNull();
  });
});
