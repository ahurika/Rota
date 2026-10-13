import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ShiftsView } from '../../src/features/shifts/ShiftsView';
import { useUiStore } from '../../src/state/uiStore';

export default function ShiftsScreen() {
  const theme = useTheme();
  const currentTeamId = useUiStore((s) => s.currentTeamId) || '859a9351-a67e-4a0b-9ab4-c25ac5ef9d95';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ShiftsView teamId={currentTeamId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
