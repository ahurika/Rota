import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  Text,
  Switch,
  ActivityIndicator,
  useTheme,
  Surface,
  SegmentedButtons,
  Button,
  Divider,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { secureStorage } from '../../src/lib/secureStore';
import { queryClient } from '../../src/query/queryClient';
import { useUiStore } from '../../src/state/uiStore';
import { useSettings, useUpdateSettings } from '../../src/features/settings/useSettings';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog';
import { spacing, radii } from '../../src/ui/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const resetUi = useUiStore((s) => s.resetUi);
  const themeMode = useUiStore((s) => s.themeMode);
  const setThemeMode = useUiStore((s) => s.setThemeMode);

  const { data: settings, isLoading } = useSettings();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  // Sync theme from server settings if available
  useEffect(() => {
    if (settings?.theme && settings.theme !== themeMode) {
      setThemeMode(settings.theme);
    }
  }, [settings?.theme]);

  const updateMutation = useUpdateSettings({
    onError: () => {
      setErrorMessage('Failed to save settings to server. Reverted.');
      setTimeout(() => setErrorMessage(null), 3500);
    },
  });

  const handleLogoutConfirm = async () => {
    setIsLogoutDialogOpen(false);
    await secureStorage.clearTokens();
    queryClient.clear();
    resetUi();
    router.replace('/(auth)/login');
  };

  const handleToggleNotif = (key: 'shift_changes' | 'swaps' | 'billing') => {
    if (!settings) return;
    const currentVal = settings.notifTypes?.[key] ?? true;
    updateMutation.mutate({
      notifTypes: {
        [key]: !currentVal,
      },
    });
  };

  const handleThemeChange = (newTheme: string) => {
    const validTheme = newTheme as 'system' | 'light' | 'dark';
    setThemeMode(validTheme);
    updateMutation.mutate({ theme: validTheme });
  };

  const handleToggleQuietHours = () => {
    if (!settings) return;
    const isCurrentlyOff = settings.quietStart === settings.quietEnd;
    if (isCurrentlyOff) {
      updateMutation.mutate({ quietStart: '22:00', quietEnd: '06:00' });
    } else {
      updateMutation.mutate({ quietStart: '00:00', quietEnd: '00:00' });
    }
  };

  if (isLoading && !settings) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" animating color={theme.colors.primary} />
      </View>
    );
  }

  const quietHoursActive = settings ? settings.quietStart !== settings.quietEnd : false;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
          Preferences, alerts & app appearance
        </Text>
      </View>

      {errorMessage && (
        <Surface
          style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}
          elevation={0}
        >
          <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, fontWeight: '600' }}>
            {errorMessage}
          </Text>
        </Surface>
      )}

      {/* Appearance Section */}
      <Surface
        style={[
          styles.section,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        elevation={1}
      >
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Appearance
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}>
          Choose your interface color mode
        </Text>

        <SegmentedButtons
          value={themeMode}
          onValueChange={handleThemeChange}
          buttons={[
            { value: 'system', label: 'System', icon: 'brightness-auto' },
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'moon-waning-crescent' },
          ]}
        />
      </Surface>

      {/* Notifications Section */}
      <Surface
        style={[
          styles.section,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        elevation={1}
      >
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Push Notifications
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
              Shift Changes
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Alerts when shifts are assigned or changed
            </Text>
          </View>
          <Switch
            value={settings?.notifTypes?.shift_changes ?? true}
            onValueChange={() => handleToggleNotif('shift_changes')}
            color={theme.colors.primary}
          />
        </View>

        <Divider style={{ marginVertical: spacing.sm }} />

        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
              Shift Swaps
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Swap offers, responses & approvals
            </Text>
          </View>
          <Switch
            value={settings?.notifTypes?.swaps ?? true}
            onValueChange={() => handleToggleNotif('swaps')}
            color={theme.colors.primary}
          />
        </View>

        <Divider style={{ marginVertical: spacing.sm }} />

        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
              Billing Alerts
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Renewals, invoices & seat changes
            </Text>
          </View>
          <Switch
            value={settings?.notifTypes?.billing ?? true}
            onValueChange={() => handleToggleNotif('billing')}
            color={theme.colors.primary}
          />
        </View>
      </Surface>

      {/* Quiet Hours Section */}
      <Surface
        style={[
          styles.section,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        elevation={1}
      >
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Quiet Hours
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
              Sleep Schedule
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {quietHoursActive
                ? `${settings?.quietStart} to ${settings?.quietEnd} (${settings?.timezone})`
                : 'Disabled (alerts arrive immediately)'}
            </Text>
          </View>
          <Switch
            value={quietHoursActive}
            onValueChange={handleToggleQuietHours}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.infoRow}>
          <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
            Time Zone
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
            {settings?.timezone ?? 'UTC'}
          </Text>
        </View>
      </Surface>

      {/* Account / Logout Button */}
      <Button
        mode="outlined"
        icon="logout"
        textColor={theme.colors.error}
        style={[styles.logoutBtn, { borderColor: theme.colors.error }]}
        onPress={() => setIsLogoutDialogOpen(true)}
      >
        Log Out
      </Button>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        visible={isLogoutDialogOpen}
        title="Log Out"
        message="Are you sure you want to log out of Rota on this device?"
        confirmLabel="Log Out"
        destructive
        onConfirm={handleLogoutConfirm}
        onDismiss={() => setIsLogoutDialogOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.xs,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  section: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  labelCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  logoutBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
});
