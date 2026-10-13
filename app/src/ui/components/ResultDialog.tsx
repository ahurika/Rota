import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

import { extraColors } from '../theme';

type Props = {
  visible: boolean;
  kind: 'success' | 'error' | 'info';
  title: string; // "Invite sent"
  message: string; // say what happened and what happens next
  actionLabel?: string; // a specific verb: "Done", "View team"
  onClose: () => void;
};

// Use for milestone outcomes (team created, payment confirmed, plan changed, invite sent).
// Use a Snackbar for small saves (shift saved, settings saved).
export function ResultDialog({ visible, kind, title, message, actionLabel = 'Done', onClose }: Props) {
  const theme = useTheme();
  const extra = extraColors(theme.dark);
  const icon = kind === 'success' ? 'check-circle-outline' : kind === 'error' ? 'alert-circle-outline' : 'information-outline';
  const color = kind === 'success' ? extra.success : kind === 'error' ? theme.colors.error : theme.colors.primary;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose}>
        <Dialog.Icon icon={icon} color={color} size={32} />
        <Dialog.Title style={{ textAlign: 'center' }}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose} accessibilityLabel={actionLabel}>
            {actionLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
