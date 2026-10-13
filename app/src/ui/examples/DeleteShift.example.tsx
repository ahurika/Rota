// Reference only (not a route). The delete flow: confirm dialog, then a snackbar on success.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, useTheme } from 'react-native-paper';

import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useSnackbar } from '@/ui/components/SnackbarProvider';
import { toUxMessage } from '@/ui/errorMessages';

type Shift = { id: string; label: string; assigneeName: string; pendingSwaps: number };

async function deleteShift(_teamId: string, _shiftId: string): Promise<void> {
  // await api.delete(`/teams/${teamId}/shifts/${shiftId}`);
}

export function DeleteShiftButton({ teamId, shift }: { teamId: string; shift: Shift }) {
  const qc = useQueryClient();
  const snackbar = useSnackbar();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteShift(teamId, shift.id),
    onSuccess: async () => {
      setOpen(false);
      snackbar.show('Shift deleted');
      await qc.invalidateQueries({ queryKey: ['shifts', teamId] });
    },
  });

  const errorText = mutation.isError
    ? toUxMessage((mutation.error as { code?: string }).code).message
    : undefined;

  return (
    <>
      <Button textColor={theme.colors.error} onPress={() => setOpen(true)} accessibilityLabel="Delete shift">
        Delete shift
      </Button>
      <ConfirmDialog
        visible={open}
        destructive
        title="Delete this shift?"
        message={`This removes ${shift.label} for ${shift.assigneeName}${
          shift.pendingSwaps ? ` and cancels ${shift.pendingSwaps} pending swap ${shift.pendingSwaps === 1 ? 'request' : 'requests'}` : ''
        }. This cannot be undone.`}
        confirmLabel="Delete shift"
        loading={mutation.isPending}
        errorText={errorText}
        onConfirm={() => mutation.mutate()}
        onDismiss={() => {
          mutation.reset();
          setOpen(false);
        }}
      />
    </>
  );
}
