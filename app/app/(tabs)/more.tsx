import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Divider, useTheme, Surface, Text, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { useActiveTeam } from '../../src/features/teams/useActiveTeam';
import { spacing, radii } from '../../src/ui/tokens';

export default function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activeTeam } = useActiveTeam();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="More" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Team Profile Banner */}
        <Surface
          style={[
            styles.teamCard,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          elevation={0}
        >
          <Avatar.Text
            size={48}
            label={activeTeam?.name?.substring(0, 2).toUpperCase() ?? 'RO'}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.onPrimaryContainer}
          />
          <View style={styles.teamInfo}>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
              {activeTeam?.name ?? 'Main Team'}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Owner Workspace • Active
            </Text>
          </View>
        </Surface>

        {/* Navigation List */}
        <Surface
          style={[
            styles.listSurface,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          elevation={0}
        >
          <List.Item
            title="Team & Roster"
            description="Manage staff, invite members, and change roles"
            left={(props) => <List.Icon {...props} icon="account-group-outline" color={theme.colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
            onPress={() => router.push('/(tabs)/team')}
            accessibilityLabel="Open Team Roster"
          />
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <List.Item
            title="Settings"
            description="Quiet hours, time zone, notifications & appearance"
            left={(props) => <List.Icon {...props} icon="cog-outline" color={theme.colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityLabel="Open Settings"
          />
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  teamInfo: {
    flex: 1,
  },
  listSurface: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
