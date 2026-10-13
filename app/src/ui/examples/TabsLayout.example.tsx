// Reference only (not a route). In milestone M4, copy this to src/app/(tabs)/_layout.tsx.
// Role rules: all five destinations are visible to every role. Content differs by role (see docs/DESIGN.md).
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Icon } from 'react-native-paper';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { AppTabBar } from '@/ui/components/AppTabBar';

function tabIcon(on: string, off: string) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon source={focused ? on : off} size={24} color={String(color)} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  // pendingSwaps comes from a TanStack Query hook for managers and owners. Staff see no badge.
  const pendingSwaps = 0;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props: BottomTabBarProps) => <AppTabBar {...props} badges={{ swaps: pendingSwaps }} />}>
      <Tabs.Screen name="index" options={{ title: 'Schedule', tabBarIcon: tabIcon('calendar-month', 'calendar-month-outline') }} />
      <Tabs.Screen name="swaps" options={{ title: 'Swaps', tabBarIcon: tabIcon('swap-horizontal-bold', 'swap-horizontal') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: tabIcon('bell', 'bell-outline') }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: tabIcon('account-group', 'account-group-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('cog', 'cog-outline') }} />
    </Tabs>
  );
}
