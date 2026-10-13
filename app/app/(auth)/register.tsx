import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { secureStorage } from '../../src/lib/secureStore';
import { PasswordField } from '../../src/ui/components/PasswordField';
import { ScreenHeader } from '../../src/ui/components/ScreenHeader';
import { ResultDialog } from '../../src/ui/components/ResultDialog';
import { fieldMessage, toUxMessage } from '../../src/ui/errorMessages';
import { scorePassword } from '../../src/ui/passwordStrength';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);

  const strength = scorePassword(password, email);
  const emailError =
    submitted && !EMAIL_RE.test(email)
      ? fieldMessage(email ? 'EMAIL_INVALID' : 'EMAIL_REQUIRED')
      : undefined;
  const nameError = submitted && !name.trim() ? 'Enter your full name.' : undefined;
  const passwordError =
    submitted && !strength.allowed
      ? fieldMessage(password.length < 10 ? 'PASSWORD_TOO_SHORT' : 'PASSWORD_TOO_COMMON')
      : undefined;

  const handleRegister = async () => {
    setSubmitted(true);
    setServerError(null);

    if (!name.trim() || !EMAIL_RE.test(email) || !strength.allowed) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post<any>('/v1/auth/register', { email, password, name });
      if (res.tokens) {
        await secureStorage.setAccessToken(res.tokens.accessToken);
        await secureStorage.setRefreshToken(res.tokens.refreshToken);
      }
      setIsSuccessDialogOpen(true);
    } catch (err: any) {
      const ux = toUxMessage(err?.code);
      setServerError(`${ux.title}. ${ux.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Create account" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={[styles.headline, { color: theme.colors.onSurface }]}>
          Join Rota
        </Text>
        <Text variant="bodyLarge" style={[styles.subhead, { color: theme.colors.onSurfaceVariant }]}>
          Set up scheduling and team coordination in a minute.
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
            label="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            error={Boolean(nameError)}
            style={styles.input}
          />
          {nameError ? (
            <HelperText type="error" visible>
              {nameError}
            </HelperText>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
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
            onChangeText={setPassword}
            label="Password"
            email={email}
            showStrength
            autoComplete="new-password"
            errorText={passwordError}
            onSubmitEditing={handleRegister}
          />
        </View>

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={isSubmitting}
          disabled={isSubmitting}
          contentStyle={styles.buttonContent}
          style={styles.submitButton}
        >
          Create account
        </Button>

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.switchButton}
        >
          Already have an account? Log in
        </Button>
      </ScrollView>

      {/* Success Modal */}
      <ResultDialog
        visible={isSuccessDialogOpen}
        kind="success"
        title="Account created"
        message="Your account is ready. Let's look at your team schedule."
        actionLabel="Go to schedule"
        onClose={() => {
          setIsSuccessDialogOpen(false);
          router.replace('/(tabs)/shifts');
        }}
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
