import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Portal,
  Dialog,
  RadioButton,
  Text,
  Button,
  useTheme,
  List,
} from 'react-native-paper';
import { TeamSummary } from '../teams/useActiveTeam';
import { spacing, radii } from '../../ui/tokens';

interface TeamSwitcherModalProps {
  visible: boolean;
  onDismiss: () => void;
  teams: TeamSummary[];
  currentTeamId: string;
  onSelectTeam: (teamId: string) => void;
}

export function TeamSwitcherModal({
  visible,
  onDismiss,
  teams,
  currentTeamId,
  onSelectTeam,
}: TeamSwitcherModalProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          {
            backgroundColor: theme.colors.elevation.level3,
            borderRadius: radii.xl,
          },
        ]}
      >
        <Dialog.Title style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
          Switch Team
        </Dialog.Title>
        <Dialog.Content>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}
          >
            Select which workspace you want to view:
          </Text>
          <RadioButton.Group
            onValueChange={(value) => {
              onSelectTeam(value);
              onDismiss();
            }}
            value={currentTeamId}
          >
            {teams.map((t) => {
              const isSelected = t.id === currentTeamId;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.teamItem,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.secondaryContainer
                        : 'transparent',
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <RadioButton.Item
                    label={t.name}
                    value={t.id}
                    color={theme.colors.primary}
                    labelStyle={{
                      color: isSelected
                        ? theme.colors.onSecondaryContainer
                        : theme.colors.onSurface,
                      fontWeight: isSelected ? '700' : '500',
                    }}
                    style={styles.radioItem}
                  />
                </View>
              );
            })}
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} textColor={theme.colors.primary}>
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    paddingVertical: spacing.xs,
  },
  teamItem: {
    marginVertical: 4,
  },
  radioItem: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});
