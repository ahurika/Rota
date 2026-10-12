import { Hono } from 'hono';
import { z } from 'zod';
import { Expo } from 'expo-server-sdk';
import { requireAuth, AuthVariables } from '../middleware/auth.js';
import { devicesRepository } from '../repositories/devicesRepository.js';

const registerDeviceSchema = z
  .object({
    expoPushToken: z
      .string()
      .min(1)
      .refine((token) => Expo.isExpoPushToken(token), 'Invalid Expo push token format'),
    platform: z.enum(['android', 'ios', 'web']),
    deviceId: z.string().max(255).optional(),
  })
  .strict();

export const devicesRouter = new Hono<{ Variables: AuthVariables }>();

// 1. POST /v1/devices (Register device push token)
devicesRouter.post('/', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = registerDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Invalid device parameters', details: parsed.error.issues } },
      400
    );
  }

  const device = await devicesRepository.upsertDevice({
    userId,
    expoPushToken: parsed.data.expoPushToken,
    platform: parsed.data.platform,
    deviceId: parsed.data.deviceId,
  });

  return c.json({ device }, 201);
});

// 2. DELETE /v1/devices/:id (Remove device push token on logout)
devicesRouter.delete('/:id', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const deviceId = c.req.param('id');

  const deleted = await devicesRepository.deleteById(deviceId, userId);
  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Device not found' } }, 404);
  }

  return c.json({ status: 'deleted' }, 200);
});
