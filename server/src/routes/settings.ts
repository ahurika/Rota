import { Hono } from 'hono';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { requireAuth, AuthVariables } from '../middleware/auth.js';
import { settingsRepository } from '../repositories/settingsRepository.js';

const patchSettingsSchema = z
  .object({
    quietStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid HH:MM format').optional(),
    quietEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid HH:MM format').optional(),
    timezone: z
      .string()
      .refine((tz) => DateTime.now().setZone(tz).isValid, 'Invalid IANA timezone')
      .optional(),
    notifTypes: z
      .object({
        shift_changes: z.boolean().optional(),
        swaps: z.boolean().optional(),
        billing: z.boolean().optional(),
      })
      .optional(),
    language: z.string().min(2).max(10).optional(),
    theme: z.enum(['system', 'light', 'dark']).optional(),
  })
  .strict();

export const settingsRouter = new Hono<{ Variables: AuthVariables }>();

// 1. GET /v1/settings
settingsRouter.get('/', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const s = await settingsRepository.getSettings(userId);

  return c.json(
    {
      settings: {
        userId: s.user_id,
        quietStart: s.quiet_start,
        quietEnd: s.quiet_end,
        timezone: s.timezone,
        notifTypes: s.notif_types,
        language: s.language,
        theme: s.theme,
        updatedAt: {
          quietStart: s.updated_at_quiet_start,
          quietEnd: s.updated_at_quiet_end,
          timezone: s.updated_at_timezone,
          notifTypes: s.updated_at_notif_types,
          language: s.updated_at_language,
          theme: s.updated_at_theme,
        },
      },
    },
    200
  );
});

// 2. PATCH /v1/settings
settingsRouter.patch('/', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = patchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Validation failed', details: parsed.error.issues } },
      400
    );
  }

  const s = await settingsRepository.patchSettings(userId, parsed.data);

  return c.json(
    {
      settings: {
        userId: s.user_id,
        quietStart: s.quiet_start,
        quietEnd: s.quiet_end,
        timezone: s.timezone,
        notifTypes: s.notif_types,
        language: s.language,
        theme: s.theme,
        updatedAt: {
          quietStart: s.updated_at_quiet_start,
          quietEnd: s.updated_at_quiet_end,
          timezone: s.updated_at_timezone,
          notifTypes: s.updated_at_notif_types,
          language: s.updated_at_language,
          theme: s.updated_at_theme,
        },
      },
    },
    200
  );
});
