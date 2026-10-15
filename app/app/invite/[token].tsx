import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, Avatar, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useUiStore } from '../../src/state/uiStore';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { spacing, radii } from '../../src/ui/tokens';

export default function InviteScreen() {
  const theme = useTheme();
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title="Team Invitation"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/shifts'))}
      />
      <View style={styles.cardContainer}>
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
        <Card.Content style={styles.cardContent}>
          <Avatar.Icon
            size={56}
            icon="account-group-outline"
            style={{ backgroundColor: theme.colors.primaryContainer, alignSelf: 'center', marginBottom: spacing.md }}
            color={theme.colors.onPrimaryContainer}
          />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
            Team Invitation
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            You have been invited to join a team on Rota. Accept below to onboard and view your upcoming shifts.
          </Text>

          <Button
            mode="contained"
            onPress={handleAcceptInvite}
            loading={isJoining}
            disabled={isJoining}
            style={styles.joinButton}
            contentStyle={{ minHeight: 48 }}
          >
            Accept & Join Team
          </Button>

          <Button
            mode="text"
            onPress={() => router.replace('/(tabs)/shifts')}
            style={{ marginTop: spacing.sm }}
          >
            Decline
          </Button>
        </Card.Content>
      </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  cardContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  joinButton: {
    width: '100%',
    borderRadius: radii.lg,
  },
});
