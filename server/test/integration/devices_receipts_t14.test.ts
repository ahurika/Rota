import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../src/app.js';
import { primaryPool0 } from '../../src/db/shards.js';
import { notificationService } from '../../src/services/notifications/notificationService.js';
import { devicesRepository } from '../../src/repositories/devicesRepository.js';

describe('Proof Test T14: Push Notifications Receipt Handling and Device Cleanup', () => {
  const timestamp = Date.now();
  const userEmail = `user_t14_${timestamp}@example.com`;
  const password = 'Password123!Secure';
  const validExpoToken1 = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx1]';
  const validExpoToken2 = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx2]';

  it('T14: DeviceNotRegistered receipt deletes the device row from the database', async () => {
    // 1. Register user
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken } = (await regRes.json()) as any;

    // 2. Register Device 1 (which will become unregistered)
    const regDev1Res = await app.request('/v1/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        expoPushToken: validExpoToken1,
        platform: 'android',
        deviceId: 'device_unregistered_test',
      }),
    });
    expect(regDev1Res.status).toBe(201);

    // 3. Register Device 2 (which remains healthy)
    const regDev2Res = await app.request('/v1/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        expoPushToken: validExpoToken2,
        platform: 'android',
        deviceId: 'device_active_test',
      }),
    });
    expect(regDev2Res.status).toBe(201);

    // Verify both devices exist in DB
    const dev1Before = await devicesRepository.findByToken(validExpoToken1);
    const dev2Before = await devicesRepository.findByToken(validExpoToken2);
    expect(dev1Before).not.toBeNull();
    expect(dev2Before).not.toBeNull();

    // 4. Mock Expo push receipts client: Device 1 returns DeviceNotRegistered, Device 2 returns ok
    const receiptId1 = 'rcpt_err_001';
    const receiptId2 = 'rcpt_ok_002';

    const mockExpoClient: any = {
      chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
      getPushNotificationReceiptsAsync: async (ids: string[]) => {
        return {
          [receiptId1]: {
            status: 'error',
            message: 'DeviceNotRegistered: The device cannot receive push notifications',
            details: { error: 'DeviceNotRegistered' },
          },
          [receiptId2]: {
            status: 'ok',
          },
        };
      },
    };

    notificationService.setExpoClient(mockExpoClient);

    const receiptMap = new Map<string, string>();
    receiptMap.set(receiptId1, validExpoToken1);
    receiptMap.set(receiptId2, validExpoToken2);

    // 5. Execute receipt processing job (T14)
    const result = await notificationService.processReceipts(receiptMap);
    expect(result.prunedCount).toBe(1);

    // 6. Assert in PostgreSQL: Device 1 MUST BE GONE; Device 2 MUST STILL EXIST
    const dev1After = await devicesRepository.findByToken(validExpoToken1);
    const dev2After = await devicesRepository.findByToken(validExpoToken2);

    expect(dev1After).toBeNull(); // Purged!
    expect(dev2After).not.toBeNull(); // Still active!
  });
});
