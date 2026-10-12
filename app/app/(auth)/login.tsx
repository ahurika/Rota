import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { secureStorage } from '../../src/lib/secureStore.js';
import { apiClient } from '../../src/api/client.js';
import { lightTheme as theme, spacing, radii, typography, layout } from '../../src/ui/tokens.js';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post<any>('/v1/auth/login', { email, password });
      if (res.tokens) {
        await secureStorage.setAccessToken(res.tokens.accessToken);
        await secureStorage.setRefreshToken(res.tokens.refreshToken);
      }
      router.replace('/(tabs)/shifts');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rota</Text>
      <Text style={styles.subtitle}>Shift scheduling & team coordination</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="user@example.com"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="Email input"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          accessibilityLabel="Password input"
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Log In"
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.surface} />
          ) : (
            <Text style={styles.loginButtonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/(auth)/register')}
          accessibilityRole="button"
          accessibilityLabel="Create an account"
        >
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
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
  title: {
    ...typography.h1,
    color: theme.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: {
    backgroundColor: theme.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: theme.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    height: layout.minTouchTarget,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    color: theme.text,
    fontSize: 15,
  },
  loginButton: {
    minHeight: layout.minTouchTarget,
    backgroundColor: theme.primary,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginButtonText: {
    ...typography.button,
    color: theme.surface,
  },
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    ...typography.bodySmall,
    color: theme.primary,
    fontWeight: '500',
  },
});
