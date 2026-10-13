import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';

type ShowOptions = { actionLabel?: string; onAction?: () => void; bottomOffset?: number; durationMs?: number };
type Ctx = { show: (message: string, options?: ShowOptions) => void };

const SnackbarContext = createContext<Ctx | null>(null);

// One snackbar for the whole app (Material 3: one at a time, 4 seconds by default).
// Use for small confirmations ("Shift saved") and recoverable failures with a "Retry" action.
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; options: ShowOptions } | null>(null);

  const show = useCallback((message: string, options: ShowOptions = {}) => {
    setState({ message, options });
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        visible={state !== null}
        onDismiss={() => setState(null)}
        duration={state?.options.durationMs ?? 4000}
        wrapperStyle={{ bottom: state?.options.bottomOffset ?? 0 }}
        action={
          state?.options.actionLabel
            ? { label: state.options.actionLabel, onPress: () => state.options.onAction?.() }
            : undefined
        }>
        {state?.message ?? ''}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): Ctx {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used inside SnackbarProvider');
  return ctx;
}
