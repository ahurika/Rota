// Design tokens for Rota. Material Design 3 (baseline) color roles and backwards-compatible tokens.
// Generated from seed color #0E6F73 with @material/material-color-utilities (TonalSpot scheme).
// Success and warning are custom roles (Material 3 has none), harmonized toward the seed.
// Do not edit hex values by hand. To change the brand color, regenerate the scheme.

export const lightColors = {
  primary: '#00696d',
  onPrimary: '#ffffff',
  primaryContainer: '#9cf1f5',
  onPrimaryContainer: '#004f52',
  secondary: '#4a6364',
  onSecondary: '#ffffff',
  secondaryContainer: '#cce8e9',
  onSecondaryContainer: '#324b4c',
  tertiary: '#4e5f7d',
  onTertiary: '#ffffff',
  tertiaryContainer: '#d5e3ff',
  onTertiaryContainer: '#364764',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#f4fbfa',
  onBackground: '#161d1d',
  surface: '#f4fbfa',
  onSurface: '#161d1d',
  surfaceVariant: '#dae4e5',
  onSurfaceVariant: '#3f4949',
  outline: '#6f7979',
  outlineVariant: '#bec8c9',
  inverseSurface: '#2b3232',
  inverseOnSurface: '#ecf2f2',
  inversePrimary: '#80d4d8',
  scrim: '#000000',
  surfaceDim: '#d5dbdb',
  surfaceBright: '#f4fbfa',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#eff5f5',
  surfaceContainer: '#e9efef',
  surfaceContainerHigh: '#e3e9e9',
  surfaceContainerHighest: '#dde4e3',
  success: '#006d43',
  onSuccess: '#ffffff',
  successContainer: '#92f7bc',
  onSuccessContainer: '#002111',
  warning: '#7d5700',
  onWarning: '#ffffff',
  warningContainer: '#ffdeaa',
  onWarningContainer: '#271900',
} as const;

export const darkColors = {
  primary: '#80d4d8',
  onPrimary: '#003739',
  primaryContainer: '#004f52',
  onPrimaryContainer: '#9cf1f5',
  secondary: '#b1cccd',
  onSecondary: '#1b3436',
  secondaryContainer: '#324b4c',
  onSecondaryContainer: '#cce8e9',
  tertiary: '#b5c7e9',
  onTertiary: '#1f314c',
  tertiaryContainer: '#364764',
  onTertiaryContainer: '#d5e3ff',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  background: '#0e1415',
  onBackground: '#dde4e3',
  surface: '#0e1415',
  onSurface: '#dde4e3',
  surfaceVariant: '#3f4949',
  onSurfaceVariant: '#bec8c9',
  outline: '#899393',
  outlineVariant: '#3f4949',
  inverseSurface: '#dde4e3',
  inverseOnSurface: '#2b3232',
  inversePrimary: '#00696d',
  scrim: '#000000',
  surfaceDim: '#0e1415',
  surfaceBright: '#343a3b',
  surfaceContainerLowest: '#090f10',
  surfaceContainerLow: '#161d1d',
  surfaceContainer: '#1a2121',
  surfaceContainerHigh: '#252b2b',
  surfaceContainerHighest: '#303636',
  success: '#76daa1',
  onSuccess: '#003920',
  successContainer: '#005231',
  onSuccessContainer: '#92f7bc',
  warning: '#f7bd51',
  onWarning: '#422c00',
  warningContainer: '#5f4100',
  onWarningContainer: '#ffdeaa',
} as const;

export type ColorRole = keyof typeof lightColors;
export type ColorScheme = { [K in ColorRole]: string };

// Spacing: 4dp grid.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

// Shape: Material 3 corner scale.
export const shape = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 999 } as const;

// Type scale (Material 3 baseline, sp / line height). Use Paper <Text variant="..."> to apply these.
export const typeScale = {
  displaySmall: { size: 36, line: 44 },
  headlineMedium: { size: 28, line: 36 },
  headlineSmall: { size: 24, line: 32 },
  titleLarge: { size: 22, line: 28 },
  titleMedium: { size: 16, line: 24, weight: '500' },
  titleSmall: { size: 14, line: 20, weight: '500' },
  bodyLarge: { size: 16, line: 24 },
  bodyMedium: { size: 14, line: 20 },
  bodySmall: { size: 12, line: 16 },
  labelLarge: { size: 14, line: 20, weight: '500' },
  labelMedium: { size: 12, line: 16, weight: '500' },
  labelSmall: { size: 11, line: 16, weight: '500' },
} as const;

// State layer opacities (Material 3).
export const stateLayer = { hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16 } as const;

// Minimum touch target in dp (Material and WCAG guidance).
export const minTarget = 48;

// Backwards-compatibility tokens for existing screens
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

const rawSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const rawLineHeights = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 26,
  xl: 28,
  xxl: 32,
  xxxl: 40,
};

const rawWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const typography = {
  sizes: rawSizes,
  lineHeights: rawLineHeights,
  weights: rawWeights,

  h1: {
    fontSize: rawSizes.xxxl,
    lineHeight: rawLineHeights.xxxl,
    fontWeight: rawWeights.bold,
  },
  h2: {
    fontSize: rawSizes.xxl,
    lineHeight: rawLineHeights.xxl,
    fontWeight: rawWeights.bold,
  },
  h3: {
    fontSize: rawSizes.xl,
    lineHeight: rawLineHeights.xl,
    fontWeight: rawWeights.semibold,
  },
  body: {
    fontSize: rawSizes.md,
    lineHeight: rawLineHeights.md,
    fontWeight: rawWeights.regular,
  },
  bodySmall: {
    fontSize: rawSizes.sm,
    lineHeight: rawLineHeights.sm,
    fontWeight: rawWeights.regular,
  },
  button: {
    fontSize: rawSizes.md,
    lineHeight: rawLineHeights.md,
    fontWeight: rawWeights.semibold,
  },
};

export const layout = {
  minTouchTarget: 44,
};

export const lightTheme = {
  background: lightColors.background,
  surface: lightColors.surface,
  surfaceSubtle: lightColors.surfaceContainerLow,
  border: lightColors.outlineVariant,
  borderStrong: lightColors.outline,

  textPrimary: lightColors.onSurface,
  textSecondary: lightColors.onSurfaceVariant,
  textMuted: lightColors.onSurfaceVariant,
  textInverse: lightColors.onPrimary,
  text: lightColors.onSurface,

  primary: lightColors.primary,
  primaryHover: lightColors.primaryContainer,
  primarySurface: lightColors.primaryContainer,

  accent: lightColors.success,
  accentSurface: lightColors.successContainer,

  warning: lightColors.warning,
  warningSurface: lightColors.warningContainer,

  danger: lightColors.error,
  dangerSurface: lightColors.errorContainer,
  error: lightColors.error,

  statusPending: lightColors.warning,
  statusApproved: lightColors.success,
  statusRejected: lightColors.error,
};

export const darkTheme = {
  background: darkColors.background,
  surface: darkColors.surface,
  surfaceSubtle: darkColors.surfaceContainerLow,
  border: darkColors.outlineVariant,
  borderStrong: darkColors.outline,

  textPrimary: darkColors.onSurface,
  textSecondary: darkColors.onSurfaceVariant,
  textMuted: darkColors.onSurfaceVariant,
  textInverse: darkColors.onPrimary,
  text: darkColors.onSurface,

  primary: darkColors.primary,
  primaryHover: darkColors.primaryContainer,
  primarySurface: darkColors.primaryContainer,

  accent: darkColors.success,
  accentSurface: darkColors.successContainer,

  warning: darkColors.warning,
  warningSurface: darkColors.warningContainer,

  danger: darkColors.error,
  dangerSurface: darkColors.errorContainer,
  error: darkColors.error,

  statusPending: darkColors.warning,
  statusApproved: darkColors.success,
  statusRejected: darkColors.error,
};

export type Theme = typeof lightTheme;
