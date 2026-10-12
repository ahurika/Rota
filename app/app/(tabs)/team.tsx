import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightTheme as theme, spacing, radii, typography } from '../../src/ui/tokens.js';

export default function TeamScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Team Roster</Text>
        <Text style={styles.subtitle}>
          Manage team members, roles (Owner, Manager, Staff), and seat caps.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: spacing.md,
  },
  card: {
    backgroundColor: theme.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    ...typography.h2,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: theme.textMuted,
  },
});
