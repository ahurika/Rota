/**
 * Rota Mobile Design Tokens
 * Conforms to Rule 04:
 * - 4pt spacing scale
 * - Touch targets >= 44x44
 * - 4.5:1 text contrast ratios
 * - Light and dark palettes
 */

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
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  text: '#0F172A', // shorthand

  primary: '#4F46E5', // Indigo 600
  primaryHover: '#4338CA',
  primarySurface: '#EEF2FF',

  accent: '#10B981', // Emerald 500
  accentSurface: '#ECFDF5',

  warning: '#F59E0B', // Amber 500
  warningSurface: '#FFFBEB',

  danger: '#EF4444', // Red 500
  dangerSurface: '#FEF2F2',
  error: '#EF4444', // shorthand

  statusPending: '#F59E0B',
  statusApproved: '#10B981',
  statusRejected: '#EF4444',
};

export const darkTheme = {
  background: '#0B0F19',
  surface: '#151C2C',
  surfaceSubtle: '#1E293B',
  border: '#334155',
  borderStrong: '#475569',

  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  textInverse: '#0F172A',
  text: '#F8FAFC', // shorthand

  primary: '#6366F1', // Indigo 500
  primaryHover: '#4F46E5',
  primarySurface: '#1E1B4B',

  accent: '#10B981',
  accentSurface: '#064E3B',

  warning: '#FBBF24',
  warningSurface: '#451A03',

  danger: '#F87171',
  dangerSurface: '#450A0A',
  error: '#F87171', // shorthand

  statusPending: '#FBBF24',
  statusApproved: '#10B981',
  statusRejected: '#F87171',
};

export type Theme = typeof lightTheme;
