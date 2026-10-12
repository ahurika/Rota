import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { secureStorage } from '../../src/lib/secureStore.js';
import { queryClient } from '../../src/query/queryClient.js';
import { useUiStore } from '../../src/state/uiStore.js';
import { lightTheme as theme, spacing, radii, typography, layout } from '../../src/ui/tokens.js';

export default function SettingsScreen() {
  const router = useRouter();
  const resetUi = useUiStore((s) => s.resetUi);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Rota?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          // Rule 04: Clear tokens from expo-secure-store and clear query cache
          await secureStorage.clearTokens();
          queryClient.clear();
          resetUi();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Theme</Text>
          <Text style={styles.rowValue}>Light</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Offline Storage</Text>
          <Text style={styles.rowValue}>AsyncStorage (Shifts & Roster)</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out of Rota"
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: spacing.md,
  },
  section: {
    backgroundColor: theme.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.text,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowLabel: {
    ...typography.body,
    color: theme.text,
  },
  rowValue: {
    ...typography.body,
    color: theme.textMuted,
  },
  logoutButton: {
    minHeight: layout.minTouchTarget,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  logoutButtonText: {
    ...typography.button,
    color: theme.error,
    fontWeight: '600',
  },
});
