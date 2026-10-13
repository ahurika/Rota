import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Icon, Text, TextInput, useTheme } from 'react-native-paper';

import { scorePassword } from '../passwordStrength';
import { extraColors } from '../theme';
import { shape, space } from '../tokens';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  label?: string;
  email?: string; // used to catch passwords that contain the email name
  showStrength?: boolean; // sign up and reset: true. Login: false
  errorText?: string; // server or form error, shown under the field
  autoComplete?: 'new-password' | 'current-password';
  onSubmitEditing?: () => void;
};

export function PasswordField({
  value,
  onChangeText,
  label = 'Password',
  email,
  showStrength = false,
  errorText,
  autoComplete = 'current-password',
  onSubmitEditing,
}: Props) {
  const theme = useTheme();
  const extra = extraColors(theme.dark);
  const [visible, setVisible] = useState(false);
  const strength = scorePassword(value, email);

  const segmentColor = [theme.colors.outlineVariant, theme.colors.error, extra.warning, theme.colors.primary, extra.success][
    strength.score
  ];

  return (
    <View>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete === 'new-password' ? 'new-password' : 'current-password'}
        textContentType={autoComplete === 'new-password' ? 'newPassword' : 'password'}
        error={Boolean(errorText)}
        onSubmitEditing={onSubmitEditing}
        right={
          <TextInput.Icon
            icon={visible ? 'eye-off-outline' : 'eye-outline'}
            onPress={() => setVisible((v) => !v)}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          />
        }
      />
      {errorText ? (
        <HelperText type="error" visible>
          {errorText}
        </HelperText>
      ) : null}

      {showStrength && value.length > 0 ? (
        <View style={styles.meterBlock} accessibilityLiveRegion="polite">
          <View style={styles.segments} accessibilityLabel={`Password strength: ${strength.label}`}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  { backgroundColor: i <= strength.score ? segmentColor : theme.colors.outlineVariant },
                ]}
              />
            ))}
          </View>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {strength.label}. {strength.hint}
          </Text>

          {strength.checks.map((c) => (
            <View key={c.id} style={styles.checkRow}>
              <Icon
                source={c.passed ? 'check-circle' : 'circle-outline'}
                size={18}
                color={c.passed ? extra.success : theme.colors.onSurfaceVariant}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meterBlock: { gap: space.sm, paddingTop: space.xs },
  segments: { flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 4, borderRadius: shape.xs / 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
