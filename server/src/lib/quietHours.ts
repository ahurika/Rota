import { DateTime } from 'luxon';

/**
 * Calculates the next allowed release time for a notification under quiet hours.
 * Enforces Rule 01, Rule 04, and Proof Test T10.
 *
 * @param now Current timestamp (passed in explicitly to ensure pure, deterministic testing)
 * @param tz IANA time zone identifier (e.g. 'Africa/Lagos', 'America/New_York')
 * @param quietStart Start of quiet hours in HH:MM (24-hour) format
 * @param quietEnd End of quiet hours in HH:MM (24-hour) format
 * @returns Date when the notification should be released, or null if permitted to send immediately
 */
export function nextAllowedTime(
  now: Date,
  tz: string,
  quietStart: string,
  quietEnd: string
): Date | null {
  // If start equals end, quiet hours are disabled
  if (quietStart === quietEnd) {
    return null;
  }

  const local = DateTime.fromJSDate(now, { zone: tz });
  if (!local.isValid) {
    // If timezone is unknown, fail-safe to sending immediately
    return null;
  }

  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);

  const start = local.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const end = local.set({ hour: eh, minute: em, second: 0, millisecond: 0 });

  const wraps = start > end; // e.g. 22:00 to 06:00 crosses midnight boundary

  if (!wraps) {
    // Standard same-day window (e.g. 13:00 to 15:00)
    return local >= start && local < end ? end.toJSDate() : null;
  }

  // Cross-midnight window (e.g. 22:00 to 06:00)
  if (local >= start) {
    // Evening portion (after 22:00): releases at end time tomorrow morning
    return end.plus({ days: 1 }).toJSDate();
  }

  if (local < end) {
    // Early morning portion (e.g. 02:00): releases at end time today morning
    return end.toJSDate();
  }

  return null;
}
