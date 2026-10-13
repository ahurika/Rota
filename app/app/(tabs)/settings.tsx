import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { secureStorage } from '../../src/lib/secureStore';
import { queryClient } from '../../src/query/queryClient';
import { useUiStore } from '../../src/state/uiStore';
import { useSettings, useUpdateSettings } from '../../src/features/settings/useSettings';
import { lightTheme as theme, spacing, radii, typography, layout } from '../../src/ui/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const resetUi = useUiStore((s) => s.resetUi);
  const { data: settings, isLoading } = useSettings();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateSettings({
    onError: (err) => {
      setErrorMessage('Failed to save settings. Reverted.');
      setTimeout(() => setErrorMessage(null), 3000);
    },
  });

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Rota?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await secureStorage.clearTokens();
          queryClient.clear();
          resetUi();
          router.replace('/(auth)/login');
        },
      },
    ]);
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

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    updateMutation.mutate({ theme: newTheme });
  };

  const handleToggleQuietHours = () => {
    if (!settings) return;
    const isCurrentlyOff = settings.quietStart === settings.quietEnd;
    if (isCurrentlyOff) {
      // Turn on default 22:00 to 06:00
      updateMutation.mutate({ quietStart: '22:00', quietEnd: '06:00' });
    } else {
      // Turn off by setting start === end
      updateMutation.mutate({ quietStart: '00:00', quietEnd: '00:00' });
    }
  };

  if (isLoading && !settings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const quietHoursActive = settings ? settings.quietStart !== settings.quietEnd : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      )}

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Alerts</Text>
        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text style={styles.rowLabel}>Shift Changes</Text>
            <Text style={styles.rowSubtitle}>Notified when assigned or updated</Text>
          </View>
          <Switch
            value={settings?.notifTypes?.shift_changes ?? true}
            onValueChange={() => handleToggleNotif('shift_changes')}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text style={styles.rowLabel}>Shift Swaps</Text>
            <Text style={styles.rowSubtitle}>Swap offers, responses, and approvals</Text>
          </View>
          <Switch
            value={settings?.notifTypes?.swaps ?? true}
            onValueChange={() => handleToggleNotif('swaps')}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text style={styles.rowLabel}>Billing Updates</Text>
            <Text style={styles.rowSubtitle}>Invoices, renewals, and payment alerts</Text>
          </View>
          <Switch
            value={settings?.notifTypes?.billing ?? true}
            onValueChange={() => handleToggleNotif('billing')}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </View>
      </View>

      {/* Quiet Hours Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quiet Hours (Sleep Schedule)</Text>
        <View style={styles.switchRow}>
          <View style={styles.labelCol}>
            <Text style={styles.rowLabel}>Enable Quiet Hours</Text>
            <Text style={styles.rowSubtitle}>
              {quietHoursActive
                ? `${settings?.quietStart} to ${settings?.quietEnd} (${settings?.timezone})`
                : 'Disabled (alerts arrive immediately)'}
            </Text>
          </View>
          <Switch
            value={quietHoursActive}
            onValueChange={handleToggleQuietHours}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time Zone</Text>
          <Text style={styles.infoValue}>{settings?.timezone ?? 'UTC'}</Text>
        </View>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance & Theme</Text>
        <View style={styles.themeRow}>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.themeOption,
                settings?.theme === t && styles.themeOptionActive,
              ]}
              onPress={() => handleThemeChange(t)}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  settings?.theme === t && styles.themeOptionTextActive,
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Account / Logout Section */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out of Rota"
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: theme.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    backgroundColor: theme.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.text,
    marginBottom: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  labelCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: '600',
    color: theme.text,
  },
  rowSubtitle: {
    ...typography.bodySmall,
    color: theme.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: theme.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: theme.text,
    fontWeight: '500',
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  themeOption: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeOptionActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  themeOptionText: {
    ...typography.body,
    color: theme.text,
  },
  themeOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  logoutButton: {
    minHeight: layout.minTouchTarget,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  logoutButtonText: {
    ...typography.button,
    color: theme.error,
  },
});
