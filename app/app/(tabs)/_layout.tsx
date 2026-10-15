import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Icon } from 'react-native-paper';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AppTabBar } from '../../src/ui/components/AppTabBar';
import { secureStorage } from '../../src/lib/secureStore';

function tabIcon(on: string, off: string) {
  return ({ color, focused }: { color: any; focused: boolean }) => (
    <Icon source={focused ? on : off} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const router = useRouter();

  useEffect(() => {
    secureStorage.getAccessToken().then((token) => {
      if (!token) {
        router.replace('/(auth)/login');
      }
    });
  }, []);

  // Pending approvals count for managers/owners (badge on Swaps)
  const pendingSwapsCount = 2;

  // Set to true when billing needs attention (shows a dot badge on Settings for owners)
  const billingNeedsAttention = false;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props: BottomTabBarProps) => (
        <AppTabBar
          {...props}
          badges={{
            swaps: pendingSwapsCount,
            settings: billingNeedsAttention,
          }}
        />
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hidden from tab bar; redirects to Schedule
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'Schedule',
          tabBarLabel: 'Schedule',
          tabBarIcon: tabIcon('calendar-month', 'calendar-month-outline'),
          tabBarAccessibilityLabel: 'Schedule tab',
        }}
      />
      <Tabs.Screen
        name="swaps"
        options={{
          title: 'Swaps',
          tabBarLabel: 'Swaps',
          tabBarIcon: tabIcon('swap-horizontal-bold', 'swap-horizontal'),
          tabBarAccessibilityLabel: 'Swaps tab',
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Activity',
          tabBarLabel: 'Activity',
          tabBarIcon: tabIcon('bell', 'bell-outline'),
          tabBarAccessibilityLabel: 'Activity feed tab',
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarLabel: 'Team',
          tabBarIcon: tabIcon('account-group', 'account-group-outline'),
          tabBarAccessibilityLabel: 'Team roster tab',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: tabIcon('cog', 'cog-outline'),
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tabs>
  );
}
