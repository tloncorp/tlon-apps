import { createAnimations } from '@tamagui/animations-moti';
import { createMedia } from '@tamagui/react-native-media-driver';
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

export function addNegativeTokens<T extends { [k: string]: number }>(
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

const color = {
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
};

const zIndex = {
  s: 0,
  true: 0,
  m: 1,
  l: 10,
  xl: 9999,
  modalSheet: 99999,
};

export const tokens = createTokens({
  color,
  space: measures,
  size: measures,
  radius: measures,
  zIndex,
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
    secondaryBorder: '#3e3b3b',
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
    systemNoticeBackground: '#143A5E',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
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
    secondaryBorder: '#e3e3e3',
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
    systemNoticeBackground: '#3B80E8',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  dracula: {
    primaryText: '#F8F8F2',
    color: '#F8F8F2',
    secondaryText: '#6272A4',
    background: '#282A36',
    transparentBackground: 'rgba(40, 42, 54, 0)',
    secondaryBackground: '#44475A',
    shadow: 'rgba(0, 0, 0, 0.08)',
    tertiaryText: '#6272A4',
    border: '#44475A',
    secondaryBorder: '#6272A4',
    activeBorder: '#44475A',
    positiveActionText: '#50FA7B',
    positiveBackground: '#283C34',
    positiveBorder: '#2F4A3C',
    negativeActionText: '#FF5555',
    negativeBackground: '#442A2C',
    negativeBorder: '#523438',
    darkBackground: '#191A21',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#6272A4',
    systemNoticeBackground: '#143A5E',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  gruvbox: {
    primaryText: '#ebdbb2',
    color: '#ebdbb2',
    secondaryText: '#a89984',
    background: '#282828',
    transparentBackground: 'rgba(40, 40, 40, 0)',
    secondaryBackground: '#3c3836',
    shadow: 'rgba(0, 0, 0, 0.08)',
    tertiaryText: '#928374',
    border: '#504945',
    secondaryBorder: '#665c54',
    activeBorder: '#3c3836',
    positiveActionText: '#b8bb26',
    positiveBackground: '#32361a',
    positiveBorder: '#98971a',
    negativeActionText: '#fb4934',
    negativeBackground: '#3c2a2c',
    negativeBorder: '#cc241d',
    darkBackground: '#1d2021',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#928374',
    systemNoticeBackground: '#F5FAFF',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  monokai: {
    primaryText: '#F8F8F2',
    color: '#F8F8F2',
    secondaryText: '#A6A69E',
    background: '#272822',
    transparentBackground: 'rgba(39, 40, 34, 0)',
    secondaryBackground: '#383830',
    shadow: 'rgba(0, 0, 0, 0.08)',
    tertiaryText: '#75715E',
    border: '#49483E',
    secondaryBorder: '#75715E',
    activeBorder: '#383830',
    positiveActionText: '#A6E22E',
    positiveBackground: '#3E4B24',
    positiveBorder: '#4A5A2B',
    negativeActionText: '#F92672',
    negativeBackground: '#4D1F2F',
    negativeBorder: '#662939',
    darkBackground: '#1D1E19',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#75715E',
    systemNoticeBackground: '#F5FAFF',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  solarized: {
    primaryText: '#839496',
    color: '#839496',
    secondaryText: '#586e75',
    background: '#002b36',
    transparentBackground: 'rgba(0, 43, 54, 0)',
    secondaryBackground: '#073642',
    shadow: 'rgba(0, 0, 0, 0.08)',
    tertiaryText: '#657b83',
    border: '#073642',
    secondaryBorder: '#586e75',
    activeBorder: '#073642',
    positiveActionText: '#859900',
    positiveBackground: '#073642',
    positiveBorder: '#586e75',
    negativeActionText: '#dc322f',
    negativeBackground: '#073642',
    negativeBorder: '#586e75',
    darkBackground: '#001e26',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#586e75',
    systemNoticeBackground: '#F5FAFF',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  nord: {
    primaryText: '#ECEFF4',
    color: '#ECEFF4',
    secondaryText: '#E5E9F0',
    background: '#2E3440',
    transparentBackground: 'rgba(46, 52, 64, 0)',
    secondaryBackground: '#3B4252',
    shadow: 'rgba(0, 0, 0, 0.08)',
    tertiaryText: '#4C566A',
    border: '#434C5E',
    secondaryBorder: '#4C566A',
    activeBorder: '#3B4252',
    positiveActionText: '#88C0D0',
    positiveBackground: '#2E3440',
    positiveBorder: '#81A1C1',
    negativeActionText: '#BF616A',
    negativeBackground: '#3B4252',
    negativeBorder: '#4C566A',
    darkBackground: '#292E39',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#4C566A',
    // systemNoticeBackground: '#F5FAFF',
    // systemNoticeBorder: '#CCDCF3',
    // systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  greenscreen: {
    primaryText: '#00ff00',
    color: '#00ff00',
    secondaryText: '#00bb00',
    background: '#001100',
    transparentBackground: 'rgba(0, 17, 0, 0)',
    secondaryBackground: '#003300',
    shadow: 'rgba(0, 255, 0, 0.08)',
    tertiaryText: '#007700',
    border: '#005500',
    secondaryBorder: '#007700',
    activeBorder: '#003300',
    positiveActionText: '#00bb00',
    positiveBackground: '#003300',
    positiveBorder: '#005500',
    negativeActionText: '#007700',
    negativeBackground: '#001100',
    negativeBorder: '#003300',
    darkBackground: '#000900',
    overlayBackground: '#000000',
    overlayBlurTint: 'dark',
    neutralUnreadDot: '#009900',
    systemNoticeBackground: '#143A5E',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
  peony: {
    primaryText: '#d14790',
    color: '#d14790',
    secondaryText: '#e358a1',
    background: '#ffe4f5',
    transparentBackground: 'rgba(255, 228, 245, 0)',
    secondaryBackground: '#ffcceb',
    shadow: 'rgba(24, 24, 24, 0.1)',
    tertiaryText: '#ef68af',
    border: '#ffb6e0',
    secondaryBorder: '#ff8cc9',
    activeBorder: '#f879bc',
    positiveActionText: '#4a9f2c',
    positiveBackground: '#d2f2c0',
    positiveBorder: '#91d670',
    negativeActionText: '#d14790',
    negativeBackground: '#ffe4f5',
    negativeBorder: '#ff8cc9',
    darkBackground: '#e358a1',
    overlayBackground: '#d14790',
    overlayBlurTint: 'light',
    neutralUnreadDot: '#ef68af',
    systemNoticeBackground: '#F5FAFF',
    systemNoticeBorder: '#CCDCF3',
    systemNoticeText: '#FFFFFF',
    mediaScrim: tokens.color.mediaScrim.val,
  },
};

export const systemFont = createFont({
  family: Platform.select({
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    default: 'System',
  }),
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
    '2xl': 17,
    '3xl': 20,
    'emoji/m': 21,
    'emoji/l': 36,
    'title/l': 34,
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

export const media = createMedia({
  sm: { maxWidth: 768 },
  gtSm: { minWidth: 768 + 1 },
});

const desktopRawMeasures = {
  '2xs': 2,
  xs: 4,
  s: 6,
  m: 8,
  l: 10,
  xl: 14,
  true: 14,
  '2xl': 22,
  '3xl': 28,
  '3.5xl': 32,
  '4xl': 44,
  '5xl': 60,
  '6xl': 68,
  '9xl': 92,
};

const desktopMeasures = addNegativeTokens(desktopRawMeasures);

const desktopSystemFont = {
  ...systemFont,
  size: {
    xs: 10,
    s: 12,
    m: 14,
    true: 14,
    l: 16,
    xl: 20,
    l2: 24,
    '2xl': 28,
    '3xl': 36,
  },
  lineHeight: {
    xs: 14,
    s: 20,
    m: 22,
    true: 22,
    l: 22,
  },
};

const desktopSerifFont = {
  ...serifFont,
  size: {
    xs: 10,
    s: 12,
    m: 14,
    true: 14,
    l: 16,
    xl: 28,
    '2xl': 36,
  },
  lineHeight: {
    s: 20,
    m: 22,
    true: 22,
    xl: 36,
  },
};

const desktopMonoFont = {
  ...monoFont,
  size: {
    s: 12,
    m: 12,
    true: 14,
    l: 14,
    xl: 14,
    '2xl': 14,
  },
  lineHeight: {
    l: 18,
  },
};

export const desktopFonts = {
  // === Tamagui components require fonts for these properties
  heading: desktopSystemFont,
  body: desktopSystemFont,
  mono: desktopMonoFont,
  serif: desktopSerifFont,
  // ===
};

export const config =
  Platform.OS === 'web'
    ? createTamagui({
        tokens: createTokens({
          color,
          space: desktopMeasures,
          size: desktopMeasures,
          radius: desktopMeasures,
          zIndex,
        }),
        fonts: desktopFonts,
        themes,
        media,
        settings: {
          defaultFont: 'body',
          allowedStyleValues: {
            space: 'somewhat-strict',
            size: 'somewhat-strict',
            radius: 'somewhat-strict',
            zIndex: 'somewhat-strict',
          },
        },
        animations,
      })
    : createTamagui({
        tokens,
        fonts,
        themes,
        media,
        settings: {
          defaultFont: 'body',
          allowedStyleValues: {
            space: 'somewhat-strict',
            size: 'somewhat-strict',
            radius: 'somewhat-strict',
            zIndex: 'somewhat-strict',
          },
        },
        animations,
      });
