import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ActivityFeedList } from '../../src/features/feed/ActivityFeedList';
import { useUiStore } from '../../src/state/uiStore';

export default function FeedScreen() {
  const theme = useTheme();
  const currentTeamId = useUiStore((s) => s.currentTeamId) || '859a9351-a67e-4a0b-9ab4-c25ac5ef9d95';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityFeedList teamId={currentTeamId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
