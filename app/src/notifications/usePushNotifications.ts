import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from '../api/client.js';

export function usePushNotifications() {
  useEffect(() => {
    registerForPushNotificationsAsync().catch((err) => {
      console.warn('Push registration warning:', err?.message || err);
    });
  }, []);
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens are not supported on standard web
  if (Platform.OS === 'web') {
    return null;
  }

  // Check and request permissions
  const existing = (await Notifications.getPermissionsAsync()) as any;
  let isGranted = existing.granted || existing.status === 'granted';

  if (!isGranted) {
    const requested = (await Notifications.requestPermissionsAsync()) as any;
    isGranted = requested.granted || requested.status === 'granted';
  }

  if (!isGranted) {
    return null;
  }

  // Get project ID from expo constants if configured
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResponse.data;

  // Register device push token with backend
  await apiClient.post('/v1/devices', {
    expoPushToken: token,
    platform: Platform.OS,
  });

  return token;
}
