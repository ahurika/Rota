import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client.js';
import { useUiStore } from '../../src/state/uiStore.js';
import { lightTheme as theme, spacing, radii, typography, layout } from '../../src/ui/tokens.js';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const setCurrentTeamId = useUiStore((s) => s.setCurrentTeamId);

  const handleAcceptInvite = async () => {
    if (!token) {
      Alert.alert('Error', 'Invalid invite link.');
      return;
    }

    try {
      setIsJoining(true);
      const res = await apiClient.post<any>(`/v1/invites/${token}/accept`, {});
      if (res.teamId) {
        setCurrentTeamId(res.teamId);
      }
      Alert.alert('Success', 'You have joined the team!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/shifts') },
      ]);
    } catch (err: any) {
      Alert.alert('Invite Error', err.message || 'Could not accept invite');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Team Invitation</Text>
        <Text style={styles.subtitle}>
          You have been invited to join a team on Rota. Tap below to accept and view your shifts.
        </Text>

        <TouchableOpacity
          style={styles.joinButton}
          onPress={handleAcceptInvite}
          disabled={isJoining}
          accessibilityRole="button"
          accessibilityLabel="Accept invitation"
        >
          {isJoining ? (
            <ActivityIndicator color={theme.surface} />
          ) : (
            <Text style={styles.joinButtonText}>Join Team</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: theme.surface,
    padding: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  joinButton: {
    minHeight: layout.minTouchTarget,
    width: '100%',
    backgroundColor: theme.primary,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    ...typography.button,
    color: theme.surface,
  },
});
