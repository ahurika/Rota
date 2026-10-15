import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, SegmentedButtons, Card, Chip, Button, ActivityIndicator, useTheme } from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog';
import { useSnackbar } from '../../src/ui/components/SnackbarProvider';
import { useActiveTeam } from '../../src/features/teams/useActiveTeam';
import { useSwaps, useDecideSwap, SwapItem } from '../../src/features/swaps/useSwaps';
import { extraColors } from '../../src/ui/theme';
import { AnimatedPressable } from '../../src/ui/components/AnimatedPressable';
import { spacing, radii } from '../../src/ui/tokens';

export default function SwapsScreen() {
  const theme = useTheme();
  const extra = extraColors(theme.dark);
  const snackbar = useSnackbar();
  const { currentTeamId } = useActiveTeam();

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [selectedSwap, setSelectedSwap] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);

  const { data: allSwaps = [], isLoading, isRefetching, refetch } = useSwaps(currentTeamId, 'all');
  const decideMutation = useDecideSwap(currentTeamId);

  const pendingSwaps = allSwaps.filter((s) => s.status === 'pending');
  const historySwaps = allSwaps.filter((s) => s.status !== 'pending');
  const currentList = tab === 'pending' ? pendingSwaps : historySwaps;

  const handleConfirmDecision = async () => {
    if (!selectedSwap) return;
    const { id, action } = selectedSwap;
    setSelectedSwap(null);

    try {
      await decideMutation.mutateAsync({
        swapId: id,
        status: action,
      });
      snackbar.show(action === 'approved' ? 'Swap request approved' : 'Swap request rejected');
    } catch (err: any) {
      snackbar.show(err?.message || 'Failed to process swap request');
    }
  };

  const formatShiftTime = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const day = start.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
      const timeStart = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const timeEnd = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${day}, ${timeStart} - ${timeEnd}`;
    } catch {
      return `${startStr} - ${endStr}`;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Shift Swaps" />

      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={tab}
          onValueChange={(val) => setTab(val as 'pending' | 'history')}
          buttons={[
            { value: 'pending', label: `Pending (${pendingSwaps.length})` },
            { value: 'history', label: `History (${historySwaps.length})` },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" animating color={theme.colors.primary} />
            <Text variant="bodyMedium" style={{ marginTop: spacing.md, color: theme.colors.onSurfaceVariant }}>
              Loading shift swap requests...
            </Text>
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 4, fontWeight: '700' }}>
              {tab === 'pending' ? 'No pending swap requests' : 'No swap history yet'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              {tab === 'pending'
                ? 'When team members request shift trades, they will appear here for manager approval.'
                : 'Decided and completed swap requests will be recorded here.'}
            </Text>
          </View>
        ) : (
          currentList.map((item) => (
            <AnimatedPressable key={item.id} scaleTo={0.98}>
              <Card
                mode="elevated"
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.elevation.level1,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
                    {formatShiftTime(item.shift_starts_at, item.shift_ends_at)}
                  </Text>
                  <Chip
                    compact
                    textStyle={{
                      color:
                        item.status === 'approved'
                          ? extra.success
                          : item.status === 'rejected'
                          ? theme.colors.error
                          : extra.warning,
                      fontSize: 11,
                      fontWeight: '800',
                    }}
                    style={{
                      backgroundColor:
                        item.status === 'approved'
                          ? extra.successContainer
                          : item.status === 'rejected'
                          ? theme.colors.errorContainer
                          : extra.warningContainer,
                    }}
                  >
                    {item.status.toUpperCase()}
                  </Chip>
                </View>

                <View style={styles.detailRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Shift: <Text style={{ color: theme.colors.onSurface, fontWeight: '700' }}>{item.shift_label}</Text>
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Requester:{' '}
                    <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{item.requester_email}</Text>
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Target Colleague:{' '}
                    <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                      {item.target_email || 'Open to Team (Anyone)'}
                    </Text>
                  </Text>
                </View>
              </Card.Content>

              {tab === 'pending' && (
                <Card.Actions style={styles.cardActions}>
                  <AnimatedPressable scaleTo={0.92} disabled={decideMutation.isPending}>
                    <Button
                      mode="outlined"
                      textColor={theme.colors.error}
                      style={{ borderColor: theme.colors.error, borderRadius: radii.full }}
                      disabled={decideMutation.isPending}
                      onPress={() => setSelectedSwap({ id: item.id, action: 'rejected' })}
                    >
                      Reject
                    </Button>
                  </AnimatedPressable>
                  <AnimatedPressable scaleTo={0.92} disabled={decideMutation.isPending}>
                    <Button
                      mode="contained"
                      style={{ borderRadius: radii.full }}
                      disabled={decideMutation.isPending}
                      onPress={() => setSelectedSwap({ id: item.id, action: 'approved' })}
                    >
                      Approve
                    </Button>
                  </AnimatedPressable>
                </Card.Actions>
              )}
            </Card>
          </AnimatedPressable>
        ))
        )}
      </ScrollView>

      {/* Confirmation Dialog for Swap Decision */}
      <ConfirmDialog
        visible={selectedSwap !== null}
        destructive={selectedSwap?.action === 'rejected'}
        title={selectedSwap?.action === 'approved' ? 'Approve this shift swap?' : 'Reject this shift swap?'}
        message={
          selectedSwap?.action === 'approved'
            ? 'This will immediately reassign the shift and notify both colleagues via push notification.'
            : 'The shift will remain assigned to the requester and they will receive a rejection notice.'
        }
        confirmLabel={selectedSwap?.action === 'approved' ? 'Approve swap' : 'Reject swap'}
        onConfirm={handleConfirmDecision}
        onDismiss={() => setSelectedSwap(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailRow: {
    marginTop: 4,
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
});
