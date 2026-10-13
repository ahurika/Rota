import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShiftsView } from '../../src/features/shifts/ShiftsView';
import { useUiStore } from '../../src/state/uiStore';
import { lightTheme as theme } from '../../src/ui/tokens';

export default function ShiftsScreen() {
  const currentTeamId = useUiStore((s) => s.currentTeamId) || '79113950-8305-4f31-99ff-f0d7e88a62ba';

  return (
    <View style={styles.container}>
      <ShiftsView teamId={currentTeamId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
});
