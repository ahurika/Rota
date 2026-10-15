import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  Portal,
  Dialog,
  Text,
  Button,
  Chip,
  IconButton,
  Surface,
  Divider,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useBilling, useProrationPreview, useChangeSubscription, PlanId, ProrationBreakdown } from './useBilling';
import { useSnackbar } from '../../ui/components/SnackbarProvider';
import { spacing, radii } from '../../ui/tokens';

interface SubscriptionManagerModalProps {
  visible: boolean;
  teamId: string;
  onDismiss: () => void;
}

const PLANS_CONFIG = [
  {
    id: 'starter' as PlanId,
    name: 'Starter Plan',
    price: '$20/mo',
    priceCents: 2000,
    includedSeats: 5,
    extraSeatPrice: 'N/A',
    maxSeats: 5,
    desc: 'Up to 5 staff included. Ideal for small coffee shops and single-location clinics.',
  },
  {
    id: 'team' as PlanId,
    name: 'Team Plan',
    price: '$50/mo',
    priceCents: 5000,
    includedSeats: 15,
    extraSeatPrice: '$3/seat',
    maxSeats: 30,
    desc: 'Up to 15 staff included, +$3/mo per extra seat (up to 30 seats).',
  },
  {
    id: 'business' as PlanId,
    name: 'Business Plan',
    price: '$120/mo',
    priceCents: 12000,
    includedSeats: 40,
    extraSeatPrice: '$2/seat',
    maxSeats: 100,
    desc: 'Up to 40 staff included, +$2/mo per extra seat (up to 100 seats). Priority dispatch.',
  },
];

export function SubscriptionManagerModal({ visible, teamId, onDismiss }: SubscriptionManagerModalProps) {
  const theme = useTheme();
  const snackbar = useSnackbar();

  const { data: sub, isLoading: isSubLoading } = useBilling(teamId);
  const previewMutation = useProrationPreview(teamId);
  const changeMutation = useChangeSubscription(teamId);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('starter');
  const [selectedSeats, setSelectedSeats] = useState<number>(5);
  const [showScenario, setShowScenario] = useState(false);

  // Initialize selected values from active subscription
  useEffect(() => {
    if (sub) {
      setSelectedPlan(sub.plan);
      setSelectedSeats(sub.seats);
    }
  }, [sub, visible]);

  // Trigger proration preview calculation whenever plan or seats change
  useEffect(() => {
    if (visible && sub) {
      previewMutation.mutate({ plan: selectedPlan, seats: selectedSeats });
    }
  }, [selectedPlan, selectedSeats, visible]);

  const currentPlanConfig = PLANS_CONFIG.find((p) => p.id === selectedPlan) || PLANS_CONFIG[0];
  const isStarter = selectedPlan === 'starter';
  const preview = previewMutation.data;

  const handlePlanSelect = (plan: PlanId) => {
    setSelectedPlan(plan);
    const targetConfig = PLANS_CONFIG.find((p) => p.id === plan);
    if (targetConfig) {
      if (plan === 'starter') {
        setSelectedSeats(5);
      } else if (selectedSeats < targetConfig.includedSeats) {
        setSelectedSeats(targetConfig.includedSeats);
      } else if (selectedSeats > targetConfig.maxSeats) {
        setSelectedSeats(targetConfig.maxSeats);
      }
    }
  };

  const handleSeatsChange = (delta: number) => {
    const next = selectedSeats + delta;
    if (next >= 1 && next <= currentPlanConfig.maxSeats) {
      setSelectedSeats(next);
    }
  };

  const handleApplyChange = async () => {
    try {
      const res = await changeMutation.mutateAsync({
        plan: selectedPlan,
        seats: selectedSeats,
        simulatePayment: true,
      });

      if (res?.status === 'scheduled') {
        snackbar.show(`Downgrade scheduled for end of billing cycle. Charged $0.00 today.`);
      } else {
        const dollars = (res?.chargeCents ? res.chargeCents / 100 : 0).toFixed(2);
        snackbar.show(`Subscription updated! Charged $${dollars} (prorated for remaining cycle).`);
      }
      onDismiss();
    } catch (err: any) {
      snackbar.show(err?.message || 'Failed to update subscription');
    }
  };

  const formatCents = (cents?: number) => {
    if (cents === undefined || cents === null) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.elevation.level3 }]}
      >
        {/* Auto-Layout Header Frame: Prevents horizontal text collision and adds dismiss button */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTextGroup}>
            <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
              Subscription & Seats
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              Fair integer-cent proration engine (Req. 5)
            </Text>
          </View>
          <IconButton
            icon="close"
            size={22}
            onPress={onDismiss}
            accessibilityLabel="Close subscription modal"
            style={styles.closeButton}
          />
        </View>

        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Active Plan Status Banner */}
            {sub && (
              <Surface
                style={[
                  styles.activeStatusBox,
                  { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
                ]}
                elevation={0}
              >
                <View style={styles.statusRow}>
                  <View style={styles.statusLeftGroup}>
                    <Chip
                      compact
                      icon="shield-check"
                      style={{ backgroundColor: theme.colors.primaryContainer }}
                      textStyle={{ fontWeight: '800', fontSize: 11, color: theme.colors.onPrimaryContainer }}
                    >
                      {sub.plan.toUpperCase()}
                    </Chip>
                    <Text variant="labelLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                      {sub.seats} Seats Active
                    </Text>
                  </View>
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                    Active Plan
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                  30-day billing cycle • Renewal: {new Date(new Date(sub.period_start).getTime() + (sub.period_days || 30) * 86400000).toLocaleDateString()}
                </Text>
              </Surface>
            )}

            {/* Plan Selection Header */}
            <View style={styles.sectionHeaderRow}>
              <Text variant="titleMedium" style={[styles.sectionHeading, { color: theme.colors.onSurface }]}>
                Choose Plan
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Integer-cent pricing
              </Text>
            </View>

            {/* Plan Selection Auto-Layout Cards */}
            <View style={styles.plansContainer}>
              {PLANS_CONFIG.map((p) => {
                const isSelected = selectedPlan === p.id;
                const isCurrent = sub?.plan === p.id;

                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handlePlanSelect(p.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.planCard,
                      {
                        borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                        backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.elevation.level1,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={styles.planCardHeader}>
                      <View style={styles.planTitleCol}>
                        <View style={styles.planTitleBadgeRow}>
                          <Text
                            variant="titleMedium"
                            style={{
                              fontWeight: '800',
                              color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                            }}
                          >
                            {p.name}
                          </Text>
                          {isCurrent && (
                            <Chip
                              compact
                              style={{
                                height: 22,
                                backgroundColor: isSelected ? theme.colors.surface : theme.colors.surfaceVariant,
                              }}
                              textStyle={{ fontSize: 10, fontWeight: '800' }}
                            >
                              Current
                            </Chip>
                          )}
                        </View>
                        <Text
                          variant="bodySmall"
                          style={{
                            color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                            marginTop: 4,
                          }}
                        >
                          {p.desc}
                        </Text>
                      </View>

                      <View style={styles.planPriceCol}>
                        <Text
                          variant="titleLarge"
                          style={{
                            fontWeight: '900',
                            color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.primary,
                          }}
                        >
                          {p.price}
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={{
                            color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                            marginTop: 2,
                          }}
                        >
                          {p.extraSeatPrice !== 'N/A' ? `${p.extraSeatPrice}` : 'fixed seats'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.planMetaRow}>
                      <Chip
                        compact
                        icon="account-multiple"
                        style={{
                          backgroundColor: isSelected ? theme.colors.surface : theme.colors.surfaceVariant,
                        }}
                        textStyle={{ fontSize: 11, fontWeight: '700' }}
                      >
                        {p.includedSeats} included
                      </Chip>
                      <Chip
                        compact
                        icon="account-arrow-up"
                        style={{
                          backgroundColor: isSelected ? theme.colors.surface : theme.colors.surfaceVariant,
                        }}
                        textStyle={{ fontSize: 11, fontWeight: '700' }}
                      >
                        Max {p.maxSeats} seats
                      </Chip>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Seat Quantity Stepper Auto-Layout Box */}
            <Surface
              style={[
                styles.seatStepperBox,
                { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
              ]}
              elevation={0}
            >
              <View style={styles.stepperHeader}>
                <View style={styles.stepperInfoCol}>
                  <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                    Team Seat Allocation
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                    {isStarter ? 'Fixed at 5 seats for Starter' : `${currentPlanConfig.extraSeatPrice} per extra seat`}
                  </Text>
                </View>

                <View style={styles.stepperControls}>
                  <IconButton
                    icon="minus"
                    size={20}
                    mode="contained-tonal"
                    disabled={isStarter || selectedSeats <= 1}
                    onPress={() => handleSeatsChange(-1)}
                    accessibilityLabel="Decrease seats"
                    style={styles.stepperBtn}
                  />
                  <Text
                    variant="titleLarge"
                    style={[styles.stepperValueText, { color: theme.colors.onSurface }]}
                  >
                    {selectedSeats}
                  </Text>
                  <IconButton
                    icon="plus"
                    size={20}
                    mode="contained-tonal"
                    disabled={isStarter || selectedSeats >= currentPlanConfig.maxSeats}
                    onPress={() => handleSeatsChange(1)}
                    accessibilityLabel="Increase seats"
                    style={styles.stepperBtn}
                  />
                </View>
              </View>
            </Surface>

            {/* Live Proration Breakdown Box (Requirement 5 Math) */}
            <View style={styles.sectionHeaderRow}>
              <Text variant="titleMedium" style={[styles.sectionHeading, { color: theme.colors.onSurface }]}>
                Proration Breakdown
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Exact cent calculations
              </Text>
            </View>

            {previewMutation.isPending ? (
              <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
            ) : preview ? (
              <Surface
                style={[
                  styles.prorationCard,
                  {
                    backgroundColor: theme.colors.elevation.level2,
                    borderColor: theme.colors.primary,
                  },
                ]}
                elevation={1}
              >
                {preview.proration.kind === 'scheduled' ? (
                  <View>
                    <View style={styles.scheduledBannerRow}>
                      <Chip
                        icon="calendar-clock"
                        style={{ backgroundColor: theme.colors.secondaryContainer }}
                        textStyle={{ fontWeight: '700', color: theme.colors.onSecondaryContainer }}
                      >
                        Downgrade Scheduled
                      </Chip>
                      <Text variant="labelLarge" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
                        $0.00 today
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                      Downgrades take effect on your next billing renewal. You keep full access to current seats until then.
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={styles.calcRow}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        Credit for unused {sub?.plan.toUpperCase()} time:
                      </Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                        -{formatCents(preview.proration.creditCents)}
                      </Text>
                    </View>

                    <View style={styles.calcRow}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        Cost of {selectedPlan.toUpperCase()} ({preview.proration.remainingDays} days remaining):
                      </Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                        +{formatCents(preview.proration.costCents)}
                      </Text>
                    </View>

                    <Divider style={{ marginVertical: 10 }} />

                    <View style={styles.calcRow}>
                      <View>
                        <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
                          Due Today:
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          Immediate prorated charge
                        </Text>
                      </View>
                      <Text variant="headlineSmall" style={{ fontWeight: '900', color: theme.colors.primary }}>
                        {formatCents(preview.proration.chargeCents)}
                      </Text>
                    </View>
                  </View>
                )}
              </Surface>
            ) : null}

            {/* Requirement 5 Ifeanyi Scenario Explanation */}
            <TouchableOpacity
              onPress={() => setShowScenario(!showScenario)}
              style={styles.scenarioToggle}
              activeOpacity={0.7}
            >
              <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                {showScenario ? 'Hide Proration Scenario' : 'View Requirement 5 Proration Scenario (Ifeanyi)'}
              </Text>
            </TouchableOpacity>

            {showScenario && (
              <Surface style={[styles.scenarioCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurfaceVariant }}>
                  Scenario: Café Upgrade on Day 10
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Ifeanyi runs a café on Starter ($20). On the 11th of a 30-day period (20 days left), he hires 4 staff and upgrades to Team ($50):{'\n'}
                  • Credit for unused Starter: 2000 × 20 ÷ 30 = 1333 cents ($13.33){'\n'}
                  • Cost of Team remaining: 5000 × 20 ÷ 30 = 3333 cents ($33.33){'\n'}
                  • Charge today: 3333 - 1333 = <Text style={{ fontWeight: '700' }}>2000 cents ($20.00)</Text>.
                </Text>
              </Surface>
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        {/* Dialog Action Buttons in Fixed Auto-Layout Footer */}
        <Dialog.Actions style={styles.dialogActions}>
          <Button onPress={onDismiss} disabled={changeMutation.isPending}>
            Cancel
          </Button>
          <Button
            mode="contained"
            loading={changeMutation.isPending}
            disabled={changeMutation.isPending || previewMutation.isPending}
            onPress={handleApplyChange}
            style={styles.confirmButton}
            labelStyle={{ fontWeight: '700' }}
          >
            {preview?.proration.kind === 'scheduled'
              ? 'Schedule Downgrade'
              : `Confirm & Upgrade (${formatCents(preview?.proration.chargeCents)})`}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radii.xl,
    maxHeight: '88%',
    maxWidth: 580,
    width: '94%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTextGroup: {
    flex: 1,
    flexDirection: 'column',
  },
  closeButton: {
    margin: 0,
    marginLeft: spacing.sm,
  },
  scrollArea: {
    paddingHorizontal: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl + 8, // Ensures clear space so bottom content is never clipped by actions
  },
  activeStatusBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionHeading: {
    fontWeight: '800',
  },
  plansContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitleCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  planTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  seatStepperBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperInfoCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    margin: 0,
  },
  stepperValueText: {
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  prorationCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  scheduledBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  scenarioToggle: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  scenarioCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  confirmButton: {
    borderRadius: radii.full,
    paddingHorizontal: 8,
  },
});
