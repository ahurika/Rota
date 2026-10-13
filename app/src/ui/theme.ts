import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { darkColors, lightColors, type ColorScheme } from './tokens';

// Paper's MD3 theme has no surfaceContainer roles, so we map Material 3 tonal surfaces
// onto Paper's elevation levels. Depth comes from tone, not shadows.
function build(base: MD3Theme, c: ColorScheme): MD3Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.onPrimaryContainer,
      secondary: c.secondary,
      onSecondary: c.onSecondary,
      secondaryContainer: c.secondaryContainer,
      onSecondaryContainer: c.onSecondaryContainer,
      tertiary: c.tertiary,
      onTertiary: c.onTertiary,
      tertiaryContainer: c.tertiaryContainer,
      onTertiaryContainer: c.onTertiaryContainer,
      error: c.error,
      onError: c.onError,
      errorContainer: c.errorContainer,
      onErrorContainer: c.onErrorContainer,
      background: c.background,
      onBackground: c.onBackground,
      surface: c.surface,
      onSurface: c.onSurface,
      surfaceVariant: c.surfaceVariant,
      onSurfaceVariant: c.onSurfaceVariant,
      outline: c.outline,
      outlineVariant: c.outlineVariant,
      inverseSurface: c.inverseSurface,
      inverseOnSurface: c.inverseOnSurface,
      inversePrimary: c.inversePrimary,
      scrim: c.scrim,
      // No drop shadows anywhere. Transparent shadow color switches them off on supported platforms.
      shadow: 'transparent',
      elevation: {
        level0: 'transparent',
        level1: c.surfaceContainerLow,
        level2: c.surfaceContainer,
        level3: c.surfaceContainerHigh,
        level4: c.surfaceContainerHigh,
        level5: c.surfaceContainerHighest,
      },
    },
  };
}

export const lightTheme = build(MD3LightTheme, lightColors);
export const darkTheme = build(MD3DarkTheme, darkColors);

// Roles Material 3 does not define. Read them with useExtraColors().
export function extraColors(isDark: boolean) {
  const c = isDark ? darkColors : lightColors;
  return {
    success: c.success,
    onSuccess: c.onSuccess,
    successContainer: c.successContainer,
    onSuccessContainer: c.onSuccessContainer,
    warning: c.warning,
    onWarning: c.onWarning,
    warningContainer: c.warningContainer,
    onWarningContainer: c.onWarningContainer,
    surfaceContainerLowest: c.surfaceContainerLowest,
    surfaceContainerLow: c.surfaceContainerLow,
    surfaceContainer: c.surfaceContainer,
    surfaceContainerHigh: c.surfaceContainerHigh,
    surfaceContainerHighest: c.surfaceContainerHighest,
  };
}
