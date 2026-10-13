import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, SegmentedButtons, Card, Chip, Button, useTheme } from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader.js';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog.js';
import { useSnackbar } from '../../src/ui/components/SnackbarProvider.js';
import { extraColors } from '../../src/ui/theme.js';

export default function SwapsScreen() {
  const theme = useTheme();
  const extra = extraColors(theme.dark);
  const snackbar = useSnackbar();

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [selectedSwap, setSelectedSwap] = useState<{ id: string; action: 'approve' | 'reject' | 'cancel' } | null>(null);

  // Mock initial swap items conforming to real schema data
  const [pendingSwaps, setPendingSwaps] = useState([
    {
      id: 'swap-1',
      shiftDate: 'Fri 17 Oct, 09:00 - 17:00',
      role: 'Head Barista',
      requester: 'Ama Mensah',
      targetColleague: 'Anyone',
      status: 'pending',
    },
    {
      id: 'swap-2',
      shiftDate: 'Sat 18 Oct, 12:00 - 20:00',
      role: 'Floor Lead',
      requester: 'Kwame Osei',
      targetColleague: 'David Chen',
      status: 'pending',
    },
  ]);

  const [historySwaps] = useState([
    {
      id: 'swap-3',
      shiftDate: 'Mon 13 Oct, 08:00 - 16:00',
      role: 'Barista',
      requester: 'Ama Mensah',
      targetColleague: 'Sarah Jenkins',
      status: 'approved',
    },
    {
      id: 'swap-4',
      shiftDate: 'Sun 12 Oct, 10:00 - 18:00',
      role: 'Kitchen Assist',
      requester: 'David Chen',
      targetColleague: 'Kwame Osei',
      status: 'rejected',
    },
  ]);

  const handleConfirmDecision = () => {
    if (!selectedSwap) return;
    const { id, action } = selectedSwap;
    setPendingSwaps((prev) => prev.filter((s) => s.id !== id));
    setSelectedSwap(null);

    if (action === 'approve') {
      snackbar.show('Swap request approved');
    } else if (action === 'reject') {
      snackbar.show('Swap request rejected');
    } else {
      snackbar.show('Swap request cancelled');
    }
  };

  const currentList = tab === 'pending' ? pendingSwaps : historySwaps;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Swaps" />

      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={tab}
          onValueChange={(val) => setTab(val as 'pending' | 'history')}
          buttons={[
            { value: 'pending', label: `Pending (${pendingSwaps.length})` },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 4 }}>
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
            <Card key={item.id} mode="outlined" style={[styles.card, { borderColor: theme.colors.outlineVariant }]}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                    {item.shiftDate}
                  </Text>
                  <Chip
                    mode="outlined"
                    textStyle={{
                      color:
                        item.status === 'approved'
                          ? extra.success
                          : item.status === 'rejected'
                          ? theme.colors.error
                          : extra.warning,
                      fontSize: 12,
                    }}
                    style={{
                      borderColor:
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

                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Role: <Text style={{ color: theme.colors.onSurface }}>{item.role}</Text>
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                  Requested by: <Text style={{ color: theme.colors.onSurface }}>{item.requester}</Text>
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                  Target colleague: <Text style={{ color: theme.colors.onSurface }}>{item.targetColleague}</Text>
                </Text>
              </Card.Content>

              {tab === 'pending' && (
                <Card.Actions style={styles.cardActions}>
                  <Button
                    mode="outlined"
                    textColor={theme.colors.error}
                    style={{ borderColor: theme.colors.error }}
                    onPress={() => setSelectedSwap({ id: item.id, action: 'reject' })}
                  >
                    Reject
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => setSelectedSwap({ id: item.id, action: 'approve' })}
                  >
                    Approve
                  </Button>
                </Card.Actions>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Confirmation Dialog for Destructive / Decisive Actions */}
      <ConfirmDialog
        visible={selectedSwap !== null}
        destructive={selectedSwap?.action === 'reject' || selectedSwap?.action === 'cancel'}
        title={
          selectedSwap?.action === 'approve'
            ? 'Approve this shift swap?'
            : selectedSwap?.action === 'reject'
            ? 'Reject this shift swap?'
            : 'Cancel your swap request?'
        }
        message={
          selectedSwap?.action === 'approve'
            ? 'This will immediately reassign the shift and notify both team members.'
            : selectedSwap?.action === 'reject'
            ? 'The requester will keep the shift and receive a rejection notice.'
            : 'The manager will no longer see this request. You can request again later.'
        }
        confirmLabel={
          selectedSwap?.action === 'approve'
            ? 'Approve swap'
            : selectedSwap?.action === 'reject'
            ? 'Reject swap'
            : 'Cancel request'
        }
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
});
