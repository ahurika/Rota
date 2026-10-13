import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useShifts, useRequestSwap, Shift } from './useShifts';
import { lightTheme as theme, spacing, radii, typography, layout } from '../../ui/tokens';

interface ShiftsViewProps {
  teamId: string;
}

export function ShiftsView({ teamId }: ShiftsViewProps) {
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  const { data: shifts, isLoading, isError, dataUpdatedAt, refetch } = useShifts(teamId);

  const swapMutation = useRequestSwap(teamId, (errorMessage) => {
    Alert.alert('Swap Request Failed', errorMessage);
  });

  const lastUpdatedText = dataUpdatedAt
    ? `Last updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null;

  const handleRequestSwap = (shift: Shift) => {
    if (isOffline) {
      Alert.alert('Offline Mode', 'Cannot submit swap requests while offline.');
      return;
    }
    swapMutation.mutate({ shiftId: shift.id });
  };

  return (
    <View style={styles.container}>
      {/* 1. Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner} testID="offline-banner">
          <Text style={styles.offlineBannerText}>
            You are offline. Showing cached shifts. Actions are disabled.
          </Text>
        </View>
      )}

      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Shifts</Text>
        {lastUpdatedText && (
          <Text style={styles.lastUpdatedText} testID="last-updated-label">
            {lastUpdatedText}
          </Text>
        )}
      </View>

      {/* 2. Loading State */}
      {isLoading && (
        <View style={styles.centerContainer} testID="shifts-loading">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.subtleText}>Loading shifts...</Text>
        </View>
      )}

      {/* 3. Error State */}
      {isError && !shifts && (
        <View style={styles.centerContainer} testID="shifts-error">
          <Text style={styles.errorText}>Unable to load shifts.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Shift List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {shifts?.length === 0 && (
          <View style={styles.centerContainer}>
            <Text style={styles.subtleText}>No upcoming shifts scheduled.</Text>
          </View>
        )}

        {shifts?.map((shift) => {
          const isPendingSwap =
            shift.swapStatus === 'pending' ||
            (swapMutation.isPending && swapMutation.variables?.shiftId === shift.id);

          const startTime = new Date(shift.starts_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const endTime = new Date(shift.ends_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View key={shift.id} style={styles.shiftCard} testID={`shift-card-${shift.id}`}>
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftLabel}>{shift.label}</Text>
                <Text style={styles.shiftHours}>
                  {startTime} - {endTime}
                </Text>
                {shift.note && <Text style={styles.shiftNote}>{shift.note}</Text>}
              </View>

              <TouchableOpacity
                style={[
                  styles.swapButton,
                  isPendingSwap && styles.swapButtonPending,
                  isOffline && styles.swapButtonDisabled,
                ]}
                onPress={() => handleRequestSwap(shift)}
                disabled={isPendingSwap || isOffline}
                accessibilityRole="button"
                accessibilityLabel={
                  isPendingSwap
                    ? 'Swap request pending'
                    : isOffline
                    ? 'Swap disabled offline'
                    : `Request swap for ${shift.label}`
                }
                testID={`swap-button-${shift.id}`}
              >
                <Text
                  style={[
                    styles.swapButtonText,
                    isPendingSwap && styles.swapButtonTextPending,
                  ]}
                >
                  {isPendingSwap ? 'Swap Pending' : isOffline ? 'Offline' : 'Request Swap'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  offlineBanner: {
    backgroundColor: theme.warningSurface,
    borderColor: theme.warning,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: theme.warning,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: theme.textPrimary,
  },
  lastUpdatedText: {
    fontSize: typography.sizes.xs,
    color: theme.textMuted,
    marginTop: spacing.xxs,
  },
  centerContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtleText: {
    fontSize: typography.sizes.sm,
    color: theme.textSecondary,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: theme.danger,
    marginBottom: spacing.md,
  },
  retryBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: {
    color: theme.textInverse,
    fontWeight: typography.weights.semibold,
  },
  listContent: {
    padding: spacing.md,
  },
  shiftCard: {
    backgroundColor: theme.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  shiftLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: theme.textPrimary,
  },
  shiftHours: {
    fontSize: typography.sizes.sm,
    color: theme.textSecondary,
    marginTop: spacing.xxs,
  },
  shiftNote: {
    fontSize: typography.sizes.xs,
    color: theme.textMuted,
    marginTop: spacing.xxs,
  },
  swapButton: {
    backgroundColor: theme.primarySurface,
    borderColor: theme.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapButtonPending: {
    backgroundColor: theme.warningSurface,
    borderColor: theme.warning,
  },
  swapButtonDisabled: {
    backgroundColor: theme.surfaceSubtle,
    borderColor: theme.border,
  },
  swapButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: theme.primary,
  },
  swapButtonTextPending: {
    color: theme.warning,
  },
});
