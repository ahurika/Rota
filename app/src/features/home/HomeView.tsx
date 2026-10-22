import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  Text,
  Button,
  useTheme,
  Surface,
  Icon,
  Avatar,
  FAB,
  IconButton,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { useActiveTeam } from '../teams/useActiveTeam';
import { useShifts } from '../shifts/useShifts';
import { TeamSwitcherModal } from './TeamSwitcherModal';
import { useUiStore } from '../../state/uiStore';
import { spacing, radii } from '../../ui/tokens';

export function HomeView() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  const { activeTeam, teams, currentTeamId } = useActiveTeam();
  const setCurrentTeamId = useUiStore((s) => s.setCurrentTeamId);
  const { data: shifts } = useShifts(currentTeamId);

  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);

  // Today's formatted date string (e.g., "MONDAY 19 OCTOBER")
  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date())
    .toUpperCase();

  // Active user initials and role (fallback to Owner for demo/primary user)
  const roleLabel = 'Owner';
  const userInitials = 'OG';

  // Check if there are any shifts scheduled for today
  const todayDateOnly = new Date().toISOString().split('T')[0];
  const todayShifts = shifts?.filter((s) => s.starts_at.startsWith(todayDateOnly)) ?? [];
  const hasShiftsToday = todayShifts.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* 1. Offline Banner */}
      {isOffline && (
        <Surface
          style={[styles.offlineBanner, { backgroundColor: theme.colors.errorContainer }]}
          elevation={0}
        >
          <Text variant="labelMedium" style={{ color: theme.colors.onErrorContainer, fontWeight: '600' }}>
            Offline mode. Showing cached overview.
          </Text>
        </Surface>
      )}

      {/* 2. Top Header Bar */}
      <View style={styles.topHeader}>
        {/* Left: Brand mark + Team selector */}
        <View style={styles.headerLeft}>
          <Surface
            style={[styles.brandBadge, { backgroundColor: theme.colors.primary }]}
            elevation={0}
          >
            <Text style={styles.brandBadgeText}>R</Text>
          </Surface>

          <Pressable
            style={styles.teamDropdownPressable}
            onPress={() => setIsTeamModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Active team: ${activeTeam?.name ?? 'Main Team'}. Tap to switch.`}
          >
            <Text
              variant="titleMedium"
              style={[styles.teamNameText, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {activeTeam?.name ?? 'Main Team'}
            </Text>
            <Icon source="chevron-down" size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {/* Right: Role Chip + Avatar */}
        <View style={styles.headerRight}>
          <Surface
            style={[
              styles.roleChip,
              {
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
            elevation={0}
          >
            <Text
              variant="labelMedium"
              style={[styles.roleText, { color: theme.colors.onSurfaceVariant }]}
            >
              {roleLabel}
            </Text>
          </Surface>

          <Avatar.Text
            size={36}
            label={userInitials}
            style={[styles.avatar, { backgroundColor: theme.colors.secondaryContainer }]}
            color={theme.colors.onSecondaryContainer}
            labelStyle={styles.avatarLabel}
          />
        </View>
      </View>

      {/* 3. Main Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Eyebrow */}
        <Text
          variant="labelMedium"
          style={[styles.dateEyebrow, { color: theme.colors.onSurfaceVariant }]}
        >
          {todayFormatted}
        </Text>

        {/* Main Title & Subtitle */}
        <Text
          variant="headlineMedium"
          style={[styles.headline, { color: theme.colors.onSurface }]}
        >
          Your day, at a glance.
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Your work and team decisions, in one place.
        </Text>

        {/* 4. Hero Card: Shift Status */}
        <Surface
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          elevation={0}
        >
          {/* Calendar Icon Badge */}
          <Surface
            style={[styles.iconBadge, { backgroundColor: theme.colors.secondaryContainer }]}
            elevation={0}
          >
            <Icon source="calendar-month-outline" size={26} color={theme.colors.primary} />
          </Surface>

          {/* Card Title */}
          <Text
            variant="titleMedium"
            style={[styles.cardTitle, { color: theme.colors.onSurface }]}
          >
            {hasShiftsToday ? `${todayShifts.length} Shift${todayShifts.length > 1 ? 's' : ''} Today` : 'No upcoming shifts'}
          </Text>

          {/* Card Description */}
          <Text
            variant="bodyMedium"
            style={[styles.cardBody, { color: theme.colors.onSurfaceVariant }]}
          >
            {hasShiftsToday
              ? 'You have active shifts scheduled for today. Check the schedule to view details or request a swap.'
              : 'All scheduled shifts for today have completed. Check the schedule to view upcoming rotas or publish new shifts.'}
          </Text>

          {/* View Schedule Button */}
          <Button
            mode="contained"
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.actionButtonContent}
            labelStyle={[styles.actionButtonLabel, { color: theme.colors.onPrimary }]}
            onPress={() => router.push('/(tabs)/shifts')}
            accessibilityRole="button"
            accessibilityLabel="View schedule"
          >
            View schedule
          </Button>
        </Surface>
      </ScrollView>

      {/* 5. Floating Action Buttons */}
      {/* Floating Gear Button (Bottom Left) */}
      <IconButton
        icon="cog"
        mode="contained"
        containerColor={theme.colors.primary}
        iconColor={theme.colors.onPrimary}
        size={24}
        style={styles.floatingSettingsButton}
        onPress={() => router.push('/(tabs)/settings')}
        accessibilityLabel="Open settings"
      />

      {/* Floating Plus FAB (Bottom Right) */}
      <FAB
        icon="plus"
        mode="flat"
        style={[styles.floatingAddFab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push('/(tabs)/shifts')}
        accessibilityLabel="Add or view shifts"
      />

      {/* Team Switcher Modal */}
      <TeamSwitcherModal
        visible={isTeamModalVisible}
        onDismiss={() => setIsTeamModalVisible(false)}
        teams={teams}
        currentTeamId={currentTeamId}
        onSelectTeam={(newId) => setCurrentTeamId(newId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  teamDropdownPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '75%',
    paddingVertical: 4,
  },
  teamNameText: {
    fontWeight: '700',
    fontSize: 17,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  avatar: {
    borderRadius: radii.full,
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 100, // accommodate bottom FABs
  },
  dateEyebrow: {
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 12,
    marginBottom: 6,
  },
  headline: {
    fontWeight: '800',
    letterSpacing: -0.5,
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  cardBody: {
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 20,
    maxWidth: 290,
  },
  actionButton: {
    borderRadius: radii.full,
    width: '100%',
  },
  actionButtonContent: {
    height: 48,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  floatingSettingsButton: {
    position: 'absolute',
    left: 20,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  floatingAddFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 28,
  },
});
