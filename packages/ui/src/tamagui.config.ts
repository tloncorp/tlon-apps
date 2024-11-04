import { createAnimations } from '@tamagui/animations-moti';
import { Platform } from 'react-native';
import { createFont, createTamagui, createTokens } from 'tamagui';

export const animations = createAnimations({
  simple: {
    type: 'timing',
    duration: 100,
  },
  quick: {
    type: 'spring',
    damping: 25,
    mass: 1,
    stiffness: 300,
  },
});

const rawMeasures = {
  '2xs': 2,
  xs: 4,
  s: 6,
  m: 8,
  l: 12,
  xl: 16,
  true: 16,
  '2xl': 24,
  '3xl': 32,
  '3.5xl': 36,
  '4xl': 48,
  '5xl': 64,
  '6xl': 72,
  '9xl': 96,
};

function addNegativeTokens<T extends { [k: string]: number }>(
  tokens: T
): T & { [K in keyof T as K extends string ? `-${K}` : never]: number } {
  return {
    ...tokens,
    ...Object.fromEntries(
      Object.entries(rawMeasures).map(([key, value]) => ['-' + key, -value])
    ),
  };
}

const measures = addNegativeTokens(rawMeasures);

export const tokens = createTokens({
  color: {
    translucentBlack: 'rgba(0, 0, 0, 0.2)',
    black: '#000000',
    gray900: '#1A1A1A',
    gray800: '#333333',
    gray700: '#4C4C4C',
    gray600: '#666666',
    gray500: '#808080',
    gray400: '#999999',
    gray300: '#B3B3B3',
    gray200: '#CCCCCC',
    gray100: '#E5E5E5',
    gray50: '#F5F5F5',
    white: '#FFFFFF',
    red: '#FF6240',
    orange: '#FF9040',
    yellow: '#FADE7A',
    green: '#2AD546',
    blue: '#008EFF',
    indigo: '#615FD3',
    redSoft: '#FFEFEC',
    orangeSoft: '#FFF4EC',
    yellowSoft: '#FAF5D9',
    greenSoft: '#EAFBEC',
    blueSoft: '#E5F4FF',
    indigoSoft: '#EFEFFB',
    darkOverlay: 'rgba(0,0,0,.8)',
    mediaScrim: 'rgba(0, 0, 0, 0.5)',
  },
  space: measures,
  size: measures,
  radius: measures,
  zIndex: {
    s: 0,
    true: 0,
    m: 1,
    l: 10,
    xl: 9999,
    modalSheet: 99999,
  },
});

export const themes = {
  dark: {
    primaryText: '#FFFFFF',
    color: '#FFFFFF',
    secondaryText: '#B3B3B3',
    background: '#1A1818',
    transparentBackground: 'rgba(24, 24, 24, 0)',
    secondaryBackground: '#322E2E',
    shadow: 'rgba(255, 255, 255, 0.08)',
    tertiaryText: '#808080',
    border: '#333333',
    secondaryBorder: '#4C4C4C',
    activeBorder: '#4C4C4C',
    positiveActionText: '#4E91F5',
    positiveBackground: '#143A5E',
    positiveBorder: '#3D567C',
    negativeActionText: '#E96A6A',
    negativeBackground: '#4B2525',
    negativeBorder: '#814444',
    darkBackground: '#4C4C4C',
    overlayBackground: '#FFFFFF',
    overlayBlurTint: 'light',
    neutralUnreadDot: '#808080',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  light: {
    primaryText: '#1A1818',
    color: '#1A1818',
    secondaryText: '#666666',
    background: '#FFFFFF',
    transparentBackground: 'rgba(255, 255, 255, 0)',
    secondaryBackground: '#F5F5F5',
    shadow: 'rgba(24, 24, 24, 0.08)',
    tertiaryText: '#999999',
    border: '#E5E5E5',
    secondaryBorder: '#CCCCCC',
    activeBorder: '#CCCCCC',
    positiveActionText: '#3B80E8',
    positiveBackground: '#F5FAFF',
    positiveBorder: '#CCDCF3',
    negativeActionText: '#E22A2A',
    negativeBackground: '#FEF5F5',
    negativeBorder: '#FCD0D0',
    darkBackground: '#333333',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#B3B3B3',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  ocean: {
    primaryText: '#D2F1F9',
    color: '#D2F1F9',
    secondaryText: '#75C4D3',
    background: '#005073',
    secondaryBackground: '#0076A3',
    shadow: 'rgba(255, 255, 255, 0.08)',
    tertiaryText: '#58C9E8',
    border: '#0076A3',
    secondaryBorder: '#4C4C4C',
    activeBorder: '#005073',
    positiveActionText: '#4A7B9D',
    positiveBackground: '#CDE5EF',
    positiveBorder: '#B2DFF0',
    negativeActionText: '#FF6347',
    negativeBackground: '#FFCCCB',
    negativeBorder: '#FF8575',
    darkBackground: '#024E6C',
    overlayBackground: '#000000',
    overlayBlurTint: 'light',
    neutralUnreadDot: '#B3B3B3',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  desert: {
    primaryText: '#4A3F35',
    color: '#4A3F35',
    secondaryText: '#9C9588',
    background: '#E6D5B8',
    secondaryBackground: '#F0E5CF',
    shadow: 'rgba(255, 255, 255, 0.08)',
    tertiaryText: '#A89F91',
    border: '#F0E5CF',
    secondaryBorder: '#4C4C4C',
    activeBorder: '#E6D5B8',
    positiveActionText: '#C27D38',
    positiveBackground: '#DECDA3',
    positiveBorder: '#E0DABE',
    negativeActionText: '#C75643',
    negativeBackground: '#E4B9B2',
    negativeBorder: '#ECD9D2',
    darkBackground: '#C9B79C',
    overlayBackground: '#000000',
    overlayBlurTint: 'light',
    neutralUnreadDot: '#B3B3B3',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  forest: {
    primaryText: '#A3BFA8',
    color: '#A3BFA8',
    secondaryText: '#849E8B',
    background: '#2F4F2F',
    secondaryBackground: '#567856',
    shadow: 'rgba(255, 255, 255, 0.08)',
    tertiaryText: '#738C70',
    border: '#567856',
    secondaryBorder: '#4C4C4C',
    activeBorder: '#2F4F2F',
    positiveActionText: '#679267',
    positiveBackground: '#8DAF8D',
    positiveBorder: '#9CC1A4',
    negativeActionText: '#8B0000',
    negativeBackground: '#E9967A',
    negativeBorder: '#F0A891',
    darkBackground: '#335233',
    overlayBackground: '#000000',
    overlayBlurTint: 'light',
    neutralUnreadDot: '#B3B3B3',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  mountain: {
    primaryText: '#D9D5C3',
    color: '#D9D5C3',
    secondaryText: '#B3ADA4',
    background: '#3E423A',
    secondaryBackground: '#767C74',
    shadow: 'rgba(255, 255, 255, 0.08)',
    tertiaryText: '#91988F',
    border: '#767C74',
    secondaryBorder: '#4C4C4C',
    activeBorder: '#3E423A',
    positiveActionText: '#6E6658',
    positiveBackground: '#8D8B7F',
    positiveBorder: '#9E9C90',
    negativeActionText: '#654321',
    negativeBackground: '#C2B280',
    negativeBorder: '#D3CBAA',
    darkBackground: '#2E3130',
    overlayBackground: '#000000',
    overlayBlurTint: 'light',
    neutralUnreadDot: '#B3B3B3',
    mediaScrim: tokens.color.mediaScrim.val,
  },
};

export const systemFont = createFont({
  family:
    'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  size: {
    xs: 12,
    s: 14,
    m: 16,
    true: 16,
    l: 17,
    xl: 24,
    // TODO: resolve this with Ochre later, sorry for the inconsistency
    l2: 32,
    // xl is used for emoji-only messages
    '2xl': 36,
    '3xl': 44,
  },
  lineHeight: {
    xs: 16,
    s: 22,
    m: 24,
    l: 24,
    true: 24,
  },
  weight: {
    s: '400',
    m: 'regular',
    true: 'regular',
    l: 'medium',
    xl: '500',
  },
  letterSpacing: {
    s: 0,
  },
});

export const serifFont = createFont({
  family: 'Georgia',
  size: {
    xs: 12,
    s: 14,
    m: 16,
    true: 16,
    l: 17,
    xl: 32,
    '2xl': 44,
  },
  lineHeight: {
    s: 22,
    m: 24,
    true: 24,
    xl: 40,
  },
  weight: {
    s: '400',
    m: 'regular',
    true: 'regular',
    l: 'medium',
  },
  letterSpacing: {
    l: 0,
  },
});

export const monoFont = createFont({
  family: Platform.select({
    android: 'monospace',
    ios: 'System-Monospaced',
    web: 'monospace',
    default: 'monospace',
  }),
  size: {
    s: 14,
    m: 14,
    true: 15,
    l: 15,
    xl: 15,
    '2xl': 15,
  },
  lineHeight: {
    l: 19,
  },
  weight: {
    l: '200',
  },
  letterSpacing: {
    l: 0,
  },
});

export const fonts = {
  // === Tamagui components require fonts for these properties
  heading: systemFont,
  body: systemFont,
  mono: monoFont,
  serif: serifFont,
  // ===
};

export const media = {
  sm: { maxWidth: 768 },
  gtSm: { minWidth: 768 + 1 },
};

export const config = createTamagui({
  tokens,
  fonts,
  themes,
  media,
  settings: {
    allowedStyleValues: {
      space: 'somewhat-strict',
      size: 'somewhat-strict',
      radius: 'somewhat-strict',
      zIndex: 'somewhat-strict',
    },
  },
  animations: animations,
});
