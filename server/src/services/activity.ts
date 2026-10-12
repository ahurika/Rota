import { z } from 'zod';
import { activityRepository, ActivityEventRow } from '../repositories/activityRepository.js';
import { AppError } from '../lib/errors.js';

const cursorSchema = z.object({
  t: z.string().datetime(),
  i: z.string().regex(/^\d+$/),
});

export interface PaginatedEventsResult {
  items: ActivityEventRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function encodeCursor(timestamp: string | Date, id: string): string {
  const t = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
  return Buffer.from(JSON.stringify({ t, i: id })).toString('base64url');
}

export function decodeCursor(rawCursor: string): { timestamp: Date; id: string } {
  try {
    const jsonStr = Buffer.from(rawCursor, 'base64url').toString('utf8');
    const parsed = cursorSchema.parse(JSON.parse(jsonStr));
    return {
      timestamp: new Date(parsed.t),
      id: parsed.i,
    };
  } catch {
    throw new AppError('INVALID_CURSOR', 400, 'Invalid pagination cursor');
  }
}

export const activityService = {
  encodeCursor,
  decodeCursor,

  async getFeed(
    teamId: string,
    rawCursor?: string,
    limitStr?: string
  ): Promise<PaginatedEventsResult> {
    let limit = 20;
    if (limitStr) {
      const parsedLimit = parseInt(limitStr, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        throw new AppError('VALIDATION_FAILED', 400, 'Invalid limit parameter');
      }
      limit = Math.min(parsedLimit, 50); // cap at 50 per skill instructions
    }

    let cursor: { timestamp: Date; id: string } | null = null;
    if (rawCursor && rawCursor.trim() !== '') {
      cursor = decodeCursor(rawCursor.trim());
    }

    const rows = await activityRepository.listEvents(teamId, cursor, limit);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  },
};
