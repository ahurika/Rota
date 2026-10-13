import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { secureStorage } from '../../src/lib/secureStore.js';
import { apiClient } from '../../src/api/client.js';
import { PasswordField } from '../../src/ui/components/PasswordField.js';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader.js';
import { toUxMessage } from '../../src/ui/errorMessages.js';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleLogin = async () => {
    setServerError(null);
    let hasError = false;

    if (!email.trim()) {
      setEmailError('Enter your email address.');
      hasError = true;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError('Enter your password.');
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      const res = await apiClient.post<any>('/v1/auth/login', { email, password });
      if (res.tokens) {
        await secureStorage.setAccessToken(res.tokens.accessToken);
        await secureStorage.setRefreshToken(res.tokens.refreshToken);
      }
      router.replace('/(tabs)/shifts');
    } catch (err: any) {
      const ux = toUxMessage(err?.code || 'INVALID_CREDENTIALS');
      setServerError(`${ux.title}. ${ux.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Log in" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={[styles.headline, { color: theme.colors.onSurface }]}>
          Welcome back
        </Text>
        <Text variant="bodyLarge" style={[styles.subhead, { color: theme.colors.onSurfaceVariant }]}>
          Sign in to access your shifts and team schedule.
        </Text>

        {serverError ? (
          <View
            style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]}
            accessibilityLiveRegion="assertive"
          >
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
              {serverError}
            </Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={Boolean(emailError)}
            style={styles.input}
          />
          {emailError ? (
            <HelperText type="error" visible>
              {emailError}
            </HelperText>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <PasswordField
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
            }}
            label="Password"
            autoComplete="current-password"
            errorText={passwordError ?? undefined}
            onSubmitEditing={handleLogin}
          />
        </View>

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={isSubmitting}
          disabled={isSubmitting}
          contentStyle={styles.buttonContent}
          style={styles.submitButton}
        >
          Log in
        </Button>

        <Button
          mode="text"
          onPress={() => router.push('/(auth)/register')}
          style={styles.switchButton}
        >
          Don't have an account? Create one
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 24,
  },
  headline: {
    marginBottom: 4,
    fontWeight: '700',
  },
  subhead: {
    marginBottom: 24,
  },
  banner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'transparent',
  },
  buttonContent: {
    minHeight: 48,
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 999,
  },
  switchButton: {
    marginTop: 8,
  },
});
