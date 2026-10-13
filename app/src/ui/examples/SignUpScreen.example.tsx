// Reference only (not a route). Shows the sign up pattern: inline field errors, live password strength,
// one clear error banner for server errors, and a success dialog. Copy to src/app/(auth)/register.tsx in M1/M4.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { PasswordField } from '@/ui/components/PasswordField';
import { ResultDialog } from '@/ui/components/ResultDialog';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { fieldMessage, toUxMessage } from '@/ui/errorMessages';
import { scorePassword } from '@/ui/passwordStrength';
import { space } from '@/ui/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Show field errors after the first submit or after the user leaves a field, not while they type.
  const emailError = submitted && !EMAIL_RE.test(email) ? fieldMessage(email ? 'EMAIL_INVALID' : 'EMAIL_REQUIRED') : undefined;
  const strength = scorePassword(password, email);
  const passwordError = submitted && !strength.allowed ? fieldMessage(password.length < 10 ? 'PASSWORD_TOO_SHORT' : 'PASSWORD_TOO_COMMON') : undefined;

  async function onSubmit() {
    setSubmitted(true);
    setServerError(null);
    if (!EMAIL_RE.test(email) || !strength.allowed) return;
    setLoading(true);
    try {
      // await api.post('/auth/register', { email, password });
      setDone(true);
    } catch (e) {
      const ux = toUxMessage((e as { code?: string }).code);
      setServerError(`${ux.title}. ${ux.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Create account" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          Set up Rota for your team in a minute.
        </Text>

        {serverError ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]} accessibilityLiveRegion="assertive">
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
              {serverError}
            </Text>
          </View>
        ) : null}

        <View>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={Boolean(emailError)}
          />
          {emailError ? (
            <HelperText type="error" visible>
              {emailError}
            </HelperText>
          ) : null}
        </View>

        <PasswordField
          value={password}
          onChangeText={setPassword}
          label="Password"
          email={email}
          showStrength
          autoComplete="new-password"
          errorText={passwordError}
          onSubmitEditing={onSubmit}
        />

        <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading} contentStyle={{ minHeight: 48 }}>
          Create account
        </Button>
      </ScrollView>

      <ResultDialog
        visible={done}
        kind="success"
        title="Account created"
        message="Next, create your team and invite your staff."
        actionLabel="Create team"
        onClose={() => setDone(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  banner: { padding: space.lg, borderRadius: 12 },
});
