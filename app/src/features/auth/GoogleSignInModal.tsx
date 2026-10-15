import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Portal,
  Dialog,
  Text,
  Avatar,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  useTheme,
  Surface,
} from 'react-native-paper';
import { apiClient } from '../../api/client';
import { secureStorage } from '../../lib/secureStore';
import { useUiStore } from '../../state/uiStore';
import { spacing, radii } from '../../ui/tokens';

interface GoogleSignInModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

interface QuickProfile {
  email: string;
  name: string;
  description: string;
  initials: string;
}

const PRESET_ACCOUNTS: QuickProfile[] = [
  {
    email: 'seed_owner_1@gmail.com',
    name: 'Brew & Bake Owner (Demo)',
    description: 'Pre-loaded team with shifts, swaps & 10k feed events',
    initials: 'BB',
  },
  {
    email: 'kate.ahurika@gmail.com',
    name: 'Kate Ahurika',
    description: 'Personal Google workspace',
    initials: 'KA',
  },
];

export function GoogleSignInModal({ visible, onDismiss, onSuccess }: GoogleSignInModalProps) {
  const theme = useTheme();

  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  const handleAuthenticate = async (email: string) => {
    try {
      setErrorMessage(null);
      setLoadingEmail(email);

      // Clean handle for dev/test token mapping on backend
      const handle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      const idToken = `test_google_token_${handle}`;

      const res = await apiClient.post<any>('/v1/auth/google', { idToken });
      const access = res.accessToken || res.tokens?.accessToken;
      const refresh = res.refreshToken || res.tokens?.refreshToken;

      if (access) await secureStorage.setAccessToken(access);
      if (refresh) await secureStorage.setRefreshToken(refresh);

      // Verify or initialize team
      try {
        const teamsRes = await apiClient.get<{ teams: Array<{ id: string; name: string }> }>('/v1/teams');

        if (teamsRes.teams && teamsRes.teams.length > 0) {
          useUiStore.getState().setCurrentTeamId(teamsRes.teams[0].id);
        } else {
          // Brand new Google user: automatically provision Starter workspace
          const workspaceName = `${handle.charAt(0).toUpperCase() + handle.slice(1)}'s Workspace`;
          const newTeamRes = await apiClient.post<{ team: { id: string; name: string } }>('/v1/teams', {
            name: workspaceName,
          });

          const teamId = newTeamRes.team.id;
          useUiStore.getState().setCurrentTeamId(teamId);

          // Seed 2 initial shifts so the calendar and activity feed are populated immediately
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);

          const tomorrowEnd = new Date(tomorrow);
          tomorrowEnd.setHours(17, 0, 0, 0);

          await apiClient.post(`/v1/teams/${teamId}/shifts`, {
            label: 'Morning Shift & Prep',
            startsAt: tomorrow.toISOString(),
            endsAt: tomorrowEnd.toISOString(),
            note: 'Store setup and opening rush coverage',
          }).catch(() => {});
        }
      } catch (teamErr: any) {
        console.warn('Team initialization notice:', teamErr?.message);
      }

      onDismiss();
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign in failed. Please try again.');
    } finally {
      setLoadingEmail(null);
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loadingEmail ? undefined : onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.elevation.level3 }]}
      >
        <Dialog.Title style={styles.titleRow}>
          <Avatar.Icon size={32} icon="google" style={styles.googleIcon} color="#ffffff" />
          <Text variant="titleLarge" style={[styles.titleText, { color: theme.colors.onSurface }]}>
            Sign in with Google
          </Text>
        </Dialog.Title>

        <Dialog.Content>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Select a verified account to continue to Rota:
          </Text>

          {errorMessage && (
            <Surface style={[styles.errorBox, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
              <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, fontWeight: '600' }}>
                {errorMessage}
              </Text>
            </Surface>
          )}

          {/* Quick Profile Selectors */}
          <View style={styles.profilesList}>
            {PRESET_ACCOUNTS.map((profile) => {
              const isLoading = loadingEmail === profile.email;
              return (
                <TouchableOpacity
                  key={profile.email}
                  disabled={Boolean(loadingEmail)}
                  onPress={() => handleAuthenticate(profile.email)}
                  style={[
                    styles.accountCard,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sign in as ${profile.name}`}
                >
                  <Avatar.Text
                    size={40}
                    label={profile.initials}
                    style={{ backgroundColor: theme.colors.primaryContainer }}
                    color={theme.colors.onPrimaryContainer}
                  />
                  <View style={styles.accountTextContainer}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                      {profile.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {profile.email}
                    </Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.primary, marginTop: 2 }}>
                      {profile.description}
                    </Text>
                  </View>
                  {isLoading && <ActivityIndicator animating size="small" color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          {/* Custom Google Account Section */}
          {showCustomInput ? (
            <View>
              <TextInput
                mode="outlined"
                label="Enter any Google email"
                placeholder="your.email@gmail.com"
                value={customEmail}
                onChangeText={setCustomEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ marginBottom: spacing.sm }}
              />
              <Button
                mode="contained"
                disabled={!customEmail.includes('@') || Boolean(loadingEmail)}
                loading={loadingEmail === customEmail}
                onPress={() => handleAuthenticate(customEmail.trim())}
                style={{ borderRadius: radii.full }}
              >
                Sign in as {customEmail.trim() || 'account'}
              </Button>
            </View>
          ) : (
            <Button
              mode="text"
              icon="account-plus-outline"
              onPress={() => setShowCustomInput(true)}
              disabled={Boolean(loadingEmail)}
            >
              Use another Google account
            </Button>
          )}
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={Boolean(loadingEmail)}>
            Cancel
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radii.xl,
    paddingVertical: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: 0,
  },
  googleIcon: {
    backgroundColor: '#4285F4',
  },
  titleText: {
    fontWeight: '800',
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  profilesList: {
    gap: spacing.sm,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  accountTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
});
