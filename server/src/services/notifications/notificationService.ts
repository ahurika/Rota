import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { devicesRepository } from '../../repositories/devicesRepository.js';
import { settingsRepository } from '../../repositories/settingsRepository.js';
import { nextAllowedTime } from '../../lib/quietHours.js';
import { logger } from '../../lib/logger.js';

export interface NotificationPayload {
  type: 'shift_changes' | 'swaps' | 'billing';
  teamId?: string;
  recipients: string[];
  urgent?: boolean;
  title: string;
  body: string;
  data?: Record<string, any>;
  now?: Date; // allow passing test timestamp
}

export interface SendResult {
  userId: string;
  sentCount: number;
  delayedUntil?: Date | null;
  skippedDisabled?: boolean;
}

export class NotificationService {
  private expoClient: Expo;

  constructor(client?: Expo) {
    this.expoClient = client || new Expo();
  }

  public setExpoClient(client: Expo) {
    this.expoClient = client;
  }

  /**
   * Processes a notification delivery to a list of recipients.
   * Respects quiet hours (T10), notification toggles (FR-N5), and immediate urgency (PRD A9).
   */
  public async processNotification(payload: NotificationPayload): Promise<SendResult[]> {
    const results: SendResult[] = [];
    const now = payload.now || new Date();

    for (const userId of payload.recipients) {
      // 1. Load user settings from primary database
      const settings = await settingsRepository.getSettings(userId);

      // 2. Filter: Skip if user has toggled off this notification category
      const typeKey = payload.type;
      if (settings.notif_types && settings.notif_types[typeKey] === false) {
        logger.info({ userId, type: payload.type }, 'Notification suppressed: user disabled category');
        results.push({ userId, sentCount: 0, skippedDisabled: true });
        continue;
      }

      // 3. Check Quiet Hours (unless urgent flag is set, e.g. shift starting within 2h)
      if (!payload.urgent) {
        const releaseAt = nextAllowedTime(
          now,
          settings.timezone,
          settings.quiet_start,
          settings.quiet_end
        );

        if (releaseAt) {
          logger.info(
            { userId, releaseAt, timezone: settings.timezone },
            'Notification delayed: quiet hours active'
          );
          results.push({ userId, sentCount: 0, delayedUntil: releaseAt });
          continue; // Delayed to releaseAt, not discarded
        }
      }

      // 4. Send to user's registered devices
      const sentCount = await this.sendToUserDevices(userId, payload);
      results.push({ userId, sentCount, delayedUntil: null });
    }

    return results;
  }

  /**
   * Dispatches push notifications to all registered devices belonging to a user.
   */
  public async sendToUserDevices(userId: string, payload: Omit<NotificationPayload, 'recipients'>): Promise<number> {
    const devices = await devicesRepository.listByUser(userId);
    if (devices.length === 0) {
      return 0;
    }

    const messages: ExpoPushMessage[] = [];
    const tokenDeviceMap = new Map<string, string>(); // token -> deviceId

    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.expo_push_token)) {
        logger.warn({ token: device.expo_push_token }, 'Skipping invalid push token format');
        continue;
      }

      messages.push({
        to: device.expo_push_token,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      });

      tokenDeviceMap.set(device.expo_push_token, device.id);
    }

    if (messages.length === 0) {
      return 0;
    }

    const chunks = this.expoClient.chunkPushNotifications(messages);
    let successfulTickets = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await this.expoClient.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const token = Array.isArray(chunk[i].to) ? (chunk[i].to as string[])[0] : (chunk[i].to as string);

          if (ticket.status === 'error') {
            logger.error({ error: ticket.message, details: ticket.details }, 'Push ticket error');
            // If device unregistered, prune immediately
            if (ticket.details?.error === 'DeviceNotRegistered') {
              logger.info({ token }, 'Pruning unregistered device on ticket return');
              await devicesRepository.deleteByToken(token);
            }
          } else {
            successfulTickets++;
          }
        }
      } catch (err) {
        logger.error({ err }, 'Error sending chunk to Expo Push Service');
      }
    }

    return successfulTickets;
  }

  /**
   * Proof Test T14: Processes Expo push receipts and prunes DeviceNotRegistered devices.
   */
  public async processReceipts(receiptMap: Map<string, string>): Promise<{ prunedCount: number }> {
    const receiptIds = Array.from(receiptMap.keys());
    if (receiptIds.length === 0) {
      return { prunedCount: 0 };
    }

    let prunedCount = 0;
    try {
      const receiptIdChunks = this.expoClient.chunkPushNotificationReceiptIds(receiptIds);

      for (const chunk of receiptIdChunks) {
        const receipts = await this.expoClient.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          const token = receiptMap.get(receiptId);
          if (!token) continue;

          if (receipt.status === 'error') {
            if (receipt.details?.error === 'DeviceNotRegistered') {
              logger.info({ token, receiptId }, 'DeviceNotRegistered receipt: deleting device (T14)');
              const deleted = await devicesRepository.deleteByToken(token);
              if (deleted) {
                prunedCount++;
              }
            } else {
              logger.warn({ receiptId, error: receipt.message }, 'Receipt error (non-fatal)');
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error processing push receipts');
    }

    return { prunedCount };
  }
}

export const notificationService = new NotificationService();
