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
            feed: true, // Red dot indicator on Activity as in design
            more: billingNeedsAttention,
          }}
        />
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hidden from tab bar; redirects to Home
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('home', 'home-outline'),
          tabBarAccessibilityLabel: 'Home tab',
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
          tabBarIcon: tabIcon('chart-line', 'chart-line'),
          tabBarAccessibilityLabel: 'Activity feed tab',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: tabIcon('dots-horizontal', 'dots-horizontal'),
          tabBarAccessibilityLabel: 'More options tab',
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          href: null, // Accessible via router.push('/(tabs)/team') or More tab
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Accessible via router.push('/(tabs)/settings') or More tab
        }}
      />
    </Tabs>
  );
}
