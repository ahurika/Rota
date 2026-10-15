import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { ActivityFeedList } from '../../src/features/feed/ActivityFeedList';
import { useActiveTeam } from '../../src/features/teams/useActiveTeam';

export default function FeedScreen() {
  const theme = useTheme();
  const { currentTeamId } = useActiveTeam();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Activity" />
      <ActivityFeedList teamId={currentTeamId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
