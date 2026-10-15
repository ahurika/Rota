import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { ShiftsView } from '../../src/features/shifts/ShiftsView';
import { useActiveTeam } from '../../src/features/teams/useActiveTeam';

export default function ShiftsScreen() {
  const theme = useTheme();
  const { currentTeamId, activeTeam } = useActiveTeam();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={activeTeam ? `${activeTeam.name}` : 'Schedule'} />
      <ShiftsView teamId={currentTeamId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
