import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ProgressBar, Avatar, Chip, IconButton, Button, useTheme } from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader.js';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog.js';
import { ResultDialog } from '../../src/ui/components/ResultDialog.js';
import { useSnackbar } from '../../src/ui/components/SnackbarProvider.js';

type Member = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'staff';
};

export default function TeamScreen() {
  const theme = useTheme();
  const snackbar = useSnackbar();

  const [members, setMembers] = useState<Member[]>([
    { id: '1', name: 'Kate Ahurika', email: 'kate@brewandbake.com', role: 'owner' },
    { id: '2', name: 'Kwame Osei', email: 'kwame@brewandbake.com', role: 'manager' },
    { id: '3', name: 'Ama Mensah', email: 'ama@brewandbake.com', role: 'staff' },
    { id: '4', name: 'David Chen', email: 'david@brewandbake.com', role: 'staff' },
  ]);

  const maxSeats = 5;
  const usedSeats = members.length;
  const seatRatio = usedSeats / maxSeats;

  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const handleConfirmRemove = () => {
    if (!memberToRemove) return;
    setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
    snackbar.show(`${memberToRemove.name} removed from team`);
    setMemberToRemove(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title="Team"
        actions={[
          {
            icon: 'account-plus-outline',
            label: 'Invite member',
            onPress: () => setInviteModalOpen(true),
          },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Seat Usage Card */}
        <Card mode="outlined" style={[styles.seatCard, { borderColor: theme.colors.outlineVariant }]}>
          <Card.Content>
            <View style={styles.seatHeader}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                Seat Allocation
              </Text>
              <Chip mode="outlined" textStyle={{ fontSize: 12 }}>
                Starter Plan
              </Chip>
            </View>

            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginTop: 4 }}>
              {usedSeats} of {maxSeats} seats used
            </Text>

            <ProgressBar
              progress={seatRatio}
              color={seatRatio >= 1 ? theme.colors.error : theme.colors.primary}
              style={styles.progressBar}
            />

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              {maxSeats - usedSeats > 0
                ? `${maxSeats - usedSeats} seat remaining before plan cap.`
                : 'All included seats in use. Upgrade to Team plan to invite more.'}
            </Text>
          </Card.Content>
        </Card>

        {/* Member Roster List */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Team Members ({members.length})
        </Text>

        {members.map((member) => (
          <Card
            key={member.id}
            mode="outlined"
            style={[styles.memberCard, { borderColor: theme.colors.outlineVariant }]}
          >
            <Card.Content style={styles.memberCardContent}>
              <Avatar.Text
                size={40}
                label={member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.onPrimaryContainer}
              />

              <View style={styles.memberInfo}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                  {member.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {member.email}
                </Text>
              </View>

              <Chip
                mode="outlined"
                textStyle={{
                  fontSize: 11,
                  color:
                    member.role === 'owner'
                      ? theme.colors.primary
                      : member.role === 'manager'
                      ? theme.colors.secondary
                      : theme.colors.onSurfaceVariant,
                }}
                style={styles.roleChip}
              >
                {member.role.toUpperCase()}
              </Chip>

              {member.role !== 'owner' && (
                <IconButton
                  icon="account-remove-outline"
                  size={20}
                  iconColor={theme.colors.error}
                  accessibilityLabel={`Remove ${member.name}`}
                  onPress={() => setMemberToRemove(member)}
                />
              )}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        visible={memberToRemove !== null}
        destructive
        title={`Remove ${memberToRemove?.name ?? 'member'} from the team?`}
        message="They lose access to the team and their upcoming shifts become unassigned. Their seat becomes free."
        confirmLabel="Remove member"
        onConfirm={handleConfirmRemove}
        onDismiss={() => setMemberToRemove(null)}
      />

      {/* Invite Member Dialog */}
      <ResultDialog
        visible={inviteModalOpen}
        kind="info"
        title="Invite New Colleague"
        message="Share rota://invite/token with your team member or send an email invitation."
        actionLabel="Done"
        onClose={() => setInviteModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  seatCard: {
    marginBottom: 20,
    borderRadius: 12,
  },
  seatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  memberCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roleChip: {
    height: 28,
  },
});
