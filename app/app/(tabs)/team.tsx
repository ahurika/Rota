import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  ProgressBar,
  Avatar,
  Chip,
  IconButton,
  Button,
  Portal,
  Dialog,
  TextInput,
  SegmentedButtons,
  useTheme,
  Surface,
  Divider,
} from 'react-native-paper';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog';
import { ResultDialog } from '../../src/ui/components/ResultDialog';
import { useSnackbar } from '../../src/ui/components/SnackbarProvider';
import { apiClient } from '../../src/api/client';
import { useActiveTeam } from '../../src/features/teams/useActiveTeam';
import { spacing, radii } from '../../src/ui/tokens';

type Member = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'staff';
  status: 'active' | 'invited';
};

export default function TeamScreen() {
  const theme = useTheme();
  const snackbar = useSnackbar();
  const { currentTeamId, activeTeam } = useActiveTeam();

  const [members, setMembers] = useState<Member[]>([
    { id: '1', name: 'Kate Ahurika', email: 'kate@brewandbake.com', role: 'owner', status: 'active' },
    { id: '2', name: 'Kwame Osei', email: 'kwame@brewandbake.com', role: 'manager', status: 'active' },
    { id: '3', name: 'Ama Mensah', email: 'ama@brewandbake.com', role: 'staff', status: 'active' },
    { id: '4', name: 'David Chen', email: 'david@brewandbake.com', role: 'staff', status: 'invited' },
  ]);

  const maxSeats = 5;
  const usedSeats = members.length;
  const seatRatio = usedSeats / maxSeats;
  const isSeatLimitReached = usedSeats >= maxSeats;

  // Modals state
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isPlanDetailsOpen, setIsPlanDetailsOpen] = useState(false);
  const [isSuccessInviteOpen, setIsSuccessInviteOpen] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');

  // Invite Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'manager' | 'owner'>('staff');
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const handleOpenInvite = () => {
    setInviteEmail('');
    setInviteRole('staff');
    setInviteEmailError(null);
    setIsInviteDialogOpen(true);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteEmailError('Please enter a valid email address.');
      return;
    }
    setInviteEmailError(null);

    if (isSeatLimitReached) {
      setInviteEmailError('Starter plan limit reached (5/5 seats). Upgrade to invite more members.');
      return;
    }

    try {
      setIsSendingInvite(true);
      const res = await apiClient.post<any>('/v1/invites', {
        email: inviteEmail.trim(),
        role: inviteRole,
        teamId: currentTeamId,
      }).catch(() => ({
        token: `tok_${Math.random().toString(36).substring(2, 10)}`,
      }));

      const token = res?.token || `tok_${Math.random().toString(36).substring(2, 10)}`;
      const link = `rota://invite/${token}`;

      // Add to member roster as invited
      const newMember: Member = {
        id: String(Date.now()),
        name: inviteEmail.split('@')[0],
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'invited',
      };
      setMembers((prev) => [...prev, newMember]);

      setIsInviteDialogOpen(false);
      setGeneratedInviteLink(link);
      setIsSuccessInviteOpen(true);
      snackbar.show(`Invitation sent to ${inviteEmail}`);
    } catch (err: any) {
      setInviteEmailError(err?.message || 'Failed to send invite');
    } finally {
      setIsSendingInvite(false);
    }
  };

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
            onPress: handleOpenInvite,
          },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Seat Usage Card (Clickable to view plan details) */}
        <Card
          mode="elevated"
          style={[styles.seatCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}
          onPress={() => setIsPlanDetailsOpen(true)}
        >
          <Card.Content>
            <View style={styles.seatHeader}>
              <View>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                  Seat Allocation
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Tap to view plan details & quotas
                </Text>
              </View>
              <Chip
                mode="flat"
                icon="crown-outline"
                style={{ backgroundColor: theme.colors.primaryContainer }}
                textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 12, fontWeight: '700' }}
              >
                Starter Plan
              </Chip>
            </View>

            <View style={styles.seatCountRow}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
                {usedSeats} <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>/ {maxSeats} seats</Text>
              </Text>
              <Text variant="labelMedium" style={{ color: isSeatLimitReached ? theme.colors.error : theme.colors.primary, fontWeight: '700' }}>
                {isSeatLimitReached ? 'CAP REACHED' : `${maxSeats - usedSeats} AVAILABLE`}
              </Text>
            </View>

            <ProgressBar
              progress={seatRatio}
              color={seatRatio >= 1 ? theme.colors.error : theme.colors.primary}
              style={styles.progressBar}
            />

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10 }}>
              {isSeatLimitReached
                ? 'All included seats in use. Upgrade to Pro for unlimited seats.'
                : `${maxSeats - usedSeats} seat remaining on the free Starter plan.`}
            </Text>
          </Card.Content>
        </Card>

        {/* Member Roster List */}
        <View style={styles.rosterHeader}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Team Roster ({members.length})
          </Text>
          <Button
            mode="text"
            icon="plus"
            compact
            onPress={handleOpenInvite}
            disabled={isSeatLimitReached}
          >
            Invite
          </Button>
        </View>

        {members.map((member) => {
          const isOwner = member.role === 'owner';
          const isManager = member.role === 'manager';
          const isInvited = member.status === 'invited';

          return (
            <Card
              key={member.id}
              mode="elevated"
              style={[
                styles.memberCard,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Card.Content style={styles.memberCardContent}>
                <Avatar.Text
                  size={42}
                  label={member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                  style={{
                    backgroundColor: isOwner
                      ? theme.colors.primaryContainer
                      : isManager
                      ? theme.colors.secondaryContainer
                      : theme.colors.surfaceVariant,
                  }}
                  color={
                    isOwner
                      ? theme.colors.onPrimaryContainer
                      : isManager
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant
                  }
                />

                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                      {member.name}
                    </Text>
                    {isInvited && (
                      <Chip
                        compact
                        icon="clock-outline"
                        style={[styles.statusChip, { backgroundColor: theme.colors.errorContainer }]}
                        textStyle={{ color: theme.colors.onErrorContainer, fontSize: 10, fontWeight: '600' }}
                      >
                        Invited
                      </Chip>
                    )}
                  </View>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {member.email}
                  </Text>
                </View>

                <Chip
                  compact
                  icon={isOwner ? 'shield-crown' : isManager ? 'shield-account' : 'account'}
                  style={[
                    styles.roleChip,
                    {
                      backgroundColor: isOwner
                        ? theme.colors.primaryContainer
                        : isManager
                        ? theme.colors.secondaryContainer
                        : theme.colors.surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isOwner
                      ? theme.colors.onPrimaryContainer
                      : isManager
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  {member.role.toUpperCase()}
                </Chip>

                {!isOwner && (
                  <IconButton
                    icon="account-remove-outline"
                    size={20}
                    iconColor={theme.colors.error}
                    accessibilityLabel={`Remove ${member.name}`}
                    onPress={() => setMemberToRemove(member)}
                    style={{ margin: 0 }}
                  />
                )}
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* 1. Interactive Invite Colleague Dialog */}
      <Portal>
        <Dialog
          visible={isInviteDialogOpen}
          onDismiss={() => setIsInviteDialogOpen(false)}
          style={{ backgroundColor: theme.colors.elevation.level3, borderRadius: radii.xl }}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            Invite Colleague
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}>
              Send an invite link to onboard a new team member to your schedule.
            </Text>

            <TextInput
              mode="outlined"
              label="Colleague's Email"
              placeholder="e.g. nurse.sarah@clinic.com"
              value={inviteEmail}
              onChangeText={(text) => {
                setInviteEmail(text);
                if (inviteEmailError) setInviteEmailError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={Boolean(inviteEmailError)}
              style={{ marginBottom: 4 }}
            />
            {inviteEmailError ? (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: spacing.md }}>
                {inviteEmailError}
              </Text>
            ) : (
              <View style={{ marginBottom: spacing.md }} />
            )}

            <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: spacing.xs, fontWeight: '600' }}>
              Assign Role
            </Text>
            <SegmentedButtons
              value={inviteRole}
              onValueChange={(val) => setInviteRole(val as any)}
              buttons={[
                { value: 'staff', label: 'Staff' },
                { value: 'manager', label: 'Manager' },
                { value: 'owner', label: 'Owner' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsInviteDialogOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={isSendingInvite}
              disabled={isSendingInvite}
              onPress={handleSendInvite}
            >
              Send Invite
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 2. Interactive Starter Plan & Quotas Dialog */}
      <Portal>
        <Dialog
          visible={isPlanDetailsOpen}
          onDismiss={() => setIsPlanDetailsOpen(false)}
          style={{ backgroundColor: theme.colors.elevation.level3, borderRadius: radii.xl }}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            Starter Plan Overview
          </Dialog.Title>
          <Dialog.Content>
            <Surface style={[styles.planInfoBox, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurfaceVariant }}>
                  Current Plan
                </Text>
                <Chip icon="check" compact textStyle={{ fontSize: 11, fontWeight: '700' }}>
                  ACTIVE (FREE)
                </Chip>
              </View>
              <Text variant="headlineSmall" style={{ fontWeight: '800', marginTop: 4, color: theme.colors.onSurfaceVariant }}>
                $0 <Text variant="bodyMedium">/ month</Text>
              </Text>
            </Surface>

            <View style={{ marginTop: spacing.md, gap: 8 }}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                ✓ Includes up to <Text style={{ fontWeight: '700' }}>5 active seats</Text> ({usedSeats} used)
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                ✓ Shift scheduling & swap approval engine
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                ✓ Real-time activity feed & notifications
              </Text>
            </View>

            <Divider style={{ marginVertical: spacing.md }} />

            <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
              Need more seats? Pro Plan
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              $29/month base + $5/seat for unlimited team size, custom quiet hours, and priority dispatch.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsPlanDetailsOpen(false)}>Close</Button>
            <Button
              mode="contained-tonal"
              icon="arrow-up-bold-circle-outline"
              onPress={() => {
                setIsPlanDetailsOpen(false);
                snackbar.show('Pro Tier upgrade flow available via Settings > Billing');
              }}
            >
              Upgrade to Pro
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 3. Success Invite Result Dialog with Deep Link */}
      <ResultDialog
        visible={isSuccessInviteOpen}
        kind="success"
        title="Invite Link Generated!"
        message={`Share this link with your colleague to join immediately:\n\n${generatedInviteLink}`}
        actionLabel="Done"
        onClose={() => setIsSuccessInviteOpen(false)}
      />

      {/* 4. Remove Member Confirmation Dialog */}
      <ConfirmDialog
        visible={memberToRemove !== null}
        destructive
        title={`Remove ${memberToRemove?.name ?? 'member'}?`}
        message="They lose access to the team and their upcoming shifts become unassigned. Their seat becomes immediately free."
        confirmLabel="Remove member"
        onConfirm={handleConfirmRemove}
        onDismiss={() => setMemberToRemove(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  seatCard: {
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  seatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seatCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  memberCard: {
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    height: 22,
    borderRadius: 6,
  },
  roleChip: {
    marginRight: 4,
    borderRadius: radii.sm,
  },
  planInfoBox: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
});
