import { Appbar } from 'react-native-paper';

type Action = { icon: string; label: string; onPress: () => void };
type Props = {
  title: string;
  mode?: 'small' | 'center-aligned' | 'medium' | 'large';
  onBack?: () => void; // shows a back arrow on detail screens
  actions?: Action[]; // up to 3 icon actions, each with a label for screen readers
};

// Material 3 top app bar. Flat: no shadow, tone only.
export function ScreenHeader({ title, mode = 'small', onBack, actions = [] }: Props) {
  return (
    <Appbar.Header mode={mode} elevated={false}>
      {onBack ? <Appbar.BackAction onPress={onBack} accessibilityLabel="Back" /> : null}
      <Appbar.Content title={title} />
      {actions.slice(0, 3).map((a) => (
        <Appbar.Action key={a.icon} icon={a.icon} onPress={a.onPress} accessibilityLabel={a.label} />
      ))}
    </Appbar.Header>
  );
}
