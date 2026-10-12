/**
 * Validates notification deep-link URLs against an allow-list (Rule 04 & skill).
 * Disallows arbitrary internal routes, javascript:, or external URLs.
 */

const ALLOWED_ROUTE_PATTERNS = [
  /^\/shifts\/[a-zA-Z0-9_-]+$/,
  /^\/swaps\/[a-zA-Z0-9_-]+$/,
  /^\/billing$/,
  /^\/feed$/,
  /^\/settings$/,
];

export function validateNotificationUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  for (const pattern of ALLOWED_ROUTE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}
