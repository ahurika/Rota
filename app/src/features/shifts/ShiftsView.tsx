import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  ActivityIndicator,
  useTheme,
  Surface,
} from 'react-native-paper';
import { useNetInfo } from '@react-native-community/netinfo';
import { useShifts, useRequestSwap, Shift } from './useShifts';
import { spacing, radii } from '../../ui/tokens';

interface ShiftsViewProps {
  teamId: string;
}

export function ShiftsView({ teamId }: ShiftsViewProps) {
  const theme = useTheme();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  const { data: shifts, isLoading, isError, dataUpdatedAt, refetch } = useShifts(teamId);

  const swapMutation = useRequestSwap(teamId, (errorMessage) => {
    Alert.alert('Swap Request Failed', errorMessage);
  });

  const lastUpdatedText = dataUpdatedAt
    ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null;

  const handleRequestSwap = (shift: Shift) => {
    if (isOffline) {
      Alert.alert('Offline Mode', 'Cannot submit swap requests while offline.');
      return;
    }
    swapMutation.mutate({ shiftId: shift.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Offline Banner */}
      {isOffline && (
        <Surface
          style={[
            styles.offlineBanner,
            { backgroundColor: theme.colors.errorContainer },
          ]}
          elevation={0}
          testID="offline-banner"
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onErrorContainer, fontWeight: '600' }}
          >
            Offline. Showing cached shifts. Actions disabled.
          </Text>
        </Surface>
      )}

      {/* Header Info */}
      <View style={styles.header}>
        <View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
            Schedule
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            Upcoming team shifts & coverage
          </Text>
        </View>
        {lastUpdatedText && (
          <Chip
            compact
            icon="clock-outline"
            style={{ backgroundColor: theme.colors.surfaceVariant }}
            textStyle={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}
            testID="last-updated-label"
          >
            {lastUpdatedText}
          </Chip>
        )}
      </View>

      {/* 2. Loading State */}
      {isLoading && (
        <View style={styles.centerContainer} testID="shifts-loading">
          <ActivityIndicator size="large" animating color={theme.colors.primary} />
          <Text variant="bodyMedium" style={[styles.subtleText, { color: theme.colors.onSurfaceVariant }]}>
            Loading team shifts...
          </Text>
        </View>
      )}

      {/* 3. Error State */}
      {isError && !shifts && (
        <Surface
          style={[
            styles.errorContainer,
            { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
          ]}
          elevation={1}
          testID="shifts-error"
        >
          <Text variant="titleMedium" style={{ color: theme.colors.error, fontWeight: '700' }}>
            Unable to load shifts
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
            Please check your connection or authentication.
          </Text>
          <Button
            mode="contained-tonal"
            icon="refresh"
            style={{ marginTop: spacing.md }}
            onPress={() => refetch()}
          >
            Retry
          </Button>
        </Surface>
      )}

      {/* 4. Shift List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {shifts?.length === 0 && (
          <Surface
            style={[
              styles.emptyCard,
              { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
            ]}
            elevation={1}
          >
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
              No upcoming shifts
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              Check back once the manager publishes the roster.
            </Text>
          </Surface>
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
            <Card
              key={shift.id}
              mode="elevated"
              style={[
                styles.shiftCard,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
              testID={`shift-card-${shift.id}`}
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={[styles.shiftLabel, { color: theme.colors.onSurface }]}>
                      {shift.label}
                    </Text>
                    <View style={styles.timeRow}>
                      <Chip
                        icon="calendar-clock"
                        compact
                        style={[styles.timeChip, { backgroundColor: theme.colors.secondaryContainer }]}
                        textStyle={{ color: theme.colors.onSecondaryContainer, fontSize: 12, fontWeight: '600' }}
                      >
                        {startTime} – {endTime}
                      </Chip>
                    </View>
                    {shift.note && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                        {shift.note}
                      </Text>
                    )}
                  </View>

                  <Button
                    mode={isPendingSwap ? 'outlined' : 'contained-tonal'}
                    compact
                    loading={swapMutation.isPending && swapMutation.variables?.shiftId === shift.id}
                    disabled={isPendingSwap || isOffline}
                    onPress={() => handleRequestSwap(shift)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPendingSwap
                        ? 'Swap request pending'
                        : isOffline
                        ? 'Swap disabled offline'
                        : `Request swap for ${shift.label}`
                    }
                    testID={`swap-button-${shift.id}`}
                    style={styles.swapBtn}
                    labelStyle={{ fontSize: 12, fontWeight: '600' }}
                  >
                    {isPendingSwap ? 'Pending' : isOffline ? 'Offline' : 'Swap'}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  centerContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtleText: {
    marginTop: spacing.sm,
  },
  errorContainer: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  shiftCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftLabel: {
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  timeChip: {
    borderRadius: 8,
  },
  swapBtn: {
    marginLeft: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
});
