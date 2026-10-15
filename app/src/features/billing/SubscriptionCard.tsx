import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, Button, ProgressBar, useTheme, Surface } from 'react-native-paper';
import { useBilling } from './useBilling';
import { AnimatedPressable } from '../../ui/components/AnimatedPressable';
import { spacing, radii } from '../../ui/tokens';

interface SubscriptionCardProps {
  teamId: string;
  onManagePress: () => void;
  compact?: boolean;
}

const PLAN_META = {
  starter: { name: 'Starter Plan', price: '$20/mo', priceCents: 2000, maxSeats: 5, color: '#3B82F6' },
  team: { name: 'Team Plan', price: '$50/mo', priceCents: 5000, maxSeats: 30, color: '#8B5CF6' },
  business: { name: 'Business Plan', price: '$120/mo', priceCents: 12000, maxSeats: 100, color: '#10B981' },
};

export function SubscriptionCard({ teamId, onManagePress, compact = false }: SubscriptionCardProps) {
  const theme = useTheme();
  const { data: sub, isLoading } = useBilling(teamId);

  const planKey = (sub?.plan as keyof typeof PLAN_META) || 'starter';
  const meta = PLAN_META[planKey] || PLAN_META.starter;
  const currentSeats = sub?.seats || meta.maxSeats;
  const pendingPlan = sub?.pending_plan;

  if (compact) {
    return (
      <Surface
        style={[
          styles.compactContainer,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        elevation={1}
      >
        <View style={styles.compactRow}>
          <View style={styles.compactLeft}>
            <Chip
              compact
              icon="crown-outline"
              style={{ backgroundColor: theme.colors.primaryContainer }}
              textStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: '700', fontSize: 11 }}
            >
              {meta.name.toUpperCase()}
            </Chip>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
              {meta.price} • {currentSeats} seats
            </Text>
          </View>
          <AnimatedPressable scaleTo={0.92} onPress={onManagePress}>
            <Button
              mode="text"
              compact
              icon="cog-outline"
              onPress={onManagePress}
              labelStyle={{ fontSize: 12, fontWeight: '700' }}
            >
              Manage
            </Button>
          </AnimatedPressable>
        </View>
        {pendingPlan && (
          <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 4 }}>
            Pending downgrade to {pendingPlan.toUpperCase()} at end of period
          </Text>
        )}
      </Surface>
    );
  }

  return (
    <AnimatedPressable scaleTo={0.98} onPress={onManagePress}>
      <Card
        mode="elevated"
        style={[
          styles.fullCard,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        onPress={onManagePress}
      >
      <Card.Content>
        <View style={styles.cardHeader}>
          <View>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
              Subscription & Seats
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Integer-cent proration enabled
            </Text>
          </View>
          <Chip
            icon="crown-outline"
            mode="flat"
            style={{ backgroundColor: theme.colors.primaryContainer }}
            textStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: '700', fontSize: 12 }}
          >
            {meta.name}
          </Chip>
        </View>

        <View style={styles.priceRow}>
          <Text variant="headlineSmall" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
            {meta.price}
          </Text>
          <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {currentSeats} SEATS ACTIVE
          </Text>
        </View>

        {pendingPlan ? (
          <Surface style={[styles.pendingBanner, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
            <Text variant="labelSmall" style={{ color: theme.colors.onErrorContainer, fontWeight: '600' }}>
              Downgrade to {pendingPlan.toUpperCase()} ({sub?.pending_seats} seats) scheduled for period renewal.
            </Text>
          </Surface>
        ) : null}

        <View style={styles.actionRow}>
          <Button
            mode="contained-tonal"
            icon="credit-card-sync-outline"
            onPress={onManagePress}
            style={{ borderRadius: radii.full, marginTop: spacing.sm }}
            labelStyle={{ fontWeight: '700' }}
          >
            Manage & Change Plan
          </Button>
        </View>
      </Card.Content>
    </Card>
  </AnimatedPressable>
);
}

const styles = StyleSheet.create({
  compactContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
  },
  pendingBanner: {
    padding: spacing.xs,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
