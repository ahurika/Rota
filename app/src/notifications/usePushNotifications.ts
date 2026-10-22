import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiClient } from '../api/client';

export function usePushNotifications() {
  useEffect(() => {
    registerForPushNotificationsAsync().catch((err) => {
      console.warn('Push registration warning:', err?.message || err);
    });
  }, []);
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens are not supported on web or inside Expo Go store client (Expo Go removed remote push in SDK 53)
  if (
    Platform.OS === 'web' ||
    Constants.appOwnership === 'expo' ||
    (Constants as any).executionEnvironment === 'storeClient'
  ) {
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');
    // Check and request permissions
    const existing = (await Notifications.getPermissionsAsync()) as any;
    let isGranted = existing?.granted || existing?.status === 'granted';

    if (!isGranted) {
      const requested = (await Notifications.requestPermissionsAsync()) as any;
      isGranted = requested?.granted || requested?.status === 'granted';
    }

    if (!isGranted) {
      return null;
    }

    // Get project ID from expo constants if configured
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

    if (!projectId) {
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    // Register device push token with backend
    await apiClient.post('/v1/devices', {
      expoPushToken: token,
      platform: Platform.OS,
    });

    return token;
  } catch (err: any) {
    // Graceful fallback for environments where push tokens cannot be fetched
    console.debug('Push notification registration skipped:', err?.message);
    return null;
  }
}
