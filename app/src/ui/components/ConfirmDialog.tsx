import { useState } from 'react';
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';

type Props = {
  visible: boolean;
  title: string; // "Delete this shift?"
  message: string; // say exactly what is lost and that it cannot be undone
  confirmLabel: string; // a specific verb: "Delete shift", not "OK"
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  errorText?: string; // if the request fails, keep the dialog open and say why
  requireText?: string; // type-to-confirm for the most destructive actions (for example the team name)
  onConfirm: () => void;
  onDismiss: () => void;
};

// Material 3 basic dialog. Cancel on the left, confirm on the right.
// Tapping outside or pressing back cancels, unless a request is running.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  errorText,
  requireText,
  onConfirm,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const [typed, setTyped] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);

  // Clear the typed confirmation whenever the dialog closes, so it never opens pre-filled.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setTyped('');
  }

  const blocked = requireText ? typed.trim() !== requireText : false;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} dismissable={!loading}>
        {destructive ? <Dialog.Icon icon="alert-outline" color={theme.colors.error} /> : null}
        <Dialog.Title style={destructive ? { textAlign: 'center' } : undefined}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {message}
          </Text>
          {requireText ? (
            <>
              <TextInput
                mode="outlined"
                label={`Type "${requireText}" to confirm`}
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ marginTop: 16 }}
              />
            </>
          ) : null}
          {errorText ? (
            <HelperText type="error" visible>
              {errorText}
            </HelperText>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading} accessibilityLabel={cancelLabel}>
            {cancelLabel}
          </Button>
          <Button
            onPress={onConfirm}
            loading={loading}
            disabled={loading || blocked}
            textColor={destructive ? theme.colors.error : undefined}
            accessibilityLabel={confirmLabel}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
