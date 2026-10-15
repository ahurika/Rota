import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { ShiftsView } from '../../src/features/shifts/ShiftsView';
import { useActiveTeam } from '../../src/features/teams/useActiveTeam';
import { SubscriptionCard } from '../../src/features/billing/SubscriptionCard';
import { SubscriptionManagerModal } from '../../src/features/billing/SubscriptionManagerModal';

export default function ShiftsScreen() {
  const theme = useTheme();
  const { currentTeamId, activeTeam } = useActiveTeam();
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={activeTeam ? `${activeTeam.name}` : 'Schedule'} />
      <SubscriptionCard
        compact
        teamId={currentTeamId}
        onManagePress={() => setIsBillingModalOpen(true)}
      />
      <ShiftsView teamId={currentTeamId} />

      <SubscriptionManagerModal
        visible={isBillingModalOpen}
        teamId={currentTeamId}
        onDismiss={() => setIsBillingModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
