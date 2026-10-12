import React from 'react';
import { Tabs } from 'expo-router';
import { lightTheme as theme } from '../../src/ui/tokens.js';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          minHeight: 56,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 4,
        },
        headerStyle: {
          backgroundColor: theme.surface,
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: theme.text,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hidden from tab bar; redirects to shifts
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'Shifts',
          tabBarAccessibilityLabel: 'Shifts tab',
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarAccessibilityLabel: 'Activity feed tab',
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarAccessibilityLabel: 'Team roster tab',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tabs>
  );
}
