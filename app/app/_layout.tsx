import React, { useEffect } from 'react';
import { AppState, AppStateStatus, Platform, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { queryClient } from '../src/query/queryClient';
import { lightTheme as paperLightTheme, darkTheme as paperDarkTheme } from '../src/ui/theme';
import { SnackbarProvider } from '../src/ui/components/SnackbarProvider';
import { lightTheme as theme } from '../src/ui/tokens';
import { usePushNotifications } from '../src/notifications/usePushNotifications';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === 'dark' ? paperDarkTheme : paperLightTheme;

  // Register push notifications on launch
  usePushNotifications();

  // FR-ST2: Wire focusManager to AppState for immediate sync on foregrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={paperTheme}>
        <SnackbarProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.background },
              headerTintColor: theme.text,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ title: 'Log In', headerBackVisible: false }} />
            <Stack.Screen name="(auth)/register" options={{ title: 'Register' }} />
            <Stack.Screen name="invite/[token]" options={{ title: 'Team Invite' }} />
          </Stack>
        </SnackbarProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
