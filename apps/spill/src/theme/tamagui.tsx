import {createAnimations} from '@tamagui/animations-moti';
import {setupNativeSheet} from '@tamagui/sheet';
import React from 'react';
import {ModalView} from 'react-native-ios-modal';
import {
  TamaguiProvider as BaseTamaguiProvider,
  createFont,
  createTamagui,
  createTokens,
} from 'tamagui';

setupNativeSheet('ios', ModalView);

export const animations = createAnimations({
  simple: {
    type: 'timing',
    duration: 100,
  },
  quick: {
    type: 'spring',
    damping: 30,
    mass: 1,
    stiffness: 250,
  },
});

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
  },
  space: {
    xxs: 2,
    xs: 6,
    s: 8,
    m: 12,
    true: 12,
    l: 24,
    xl: 40,
  },
  size: {
    xs: 8,
    s: 12,
    m: 24,
    l: 32,
    true: 32,
    xl: 56,
    xxl: 72,
    xxxl: 72,
  },
  radius: {
    xs: 4,
    s: 6,
    m: 12,
    true: 12,
    l: 16,
    xl: 24,
    xxl: 100,
    xxxl: 1000,
  },
  zIndex: {
    s: 0,
    true: 0,
    m: 1,
    l: 10,
    xl: 9999,
  },
});

export const themes = {
  base: {
    background: tokens.color.white,
    backgroundOverlay: tokens.color.translucentBlack,
    secondaryBackground: tokens.color.gray50,
    activeHighlight: tokens.color.gray200,
    anchorHighlight: tokens.color.blueSoft,
    // Default color, required by some tamagui components
    color: tokens.color.gray800,
    primaryText: tokens.color.gray800,
    secondaryText: tokens.color.gray600,
    tertiaryText: tokens.color.gray400,
    inactiveText: tokens.color.gray200,
    border: tokens.color.gray100,
    borderColor: tokens.color.gray100,
    borderFocus: tokens.color.gray200,
    activeBorder: tokens.color.gray200,
    statusBar: tokens.color.black,
    error: tokens.color.red,
  },
};

export const sfFont = createFont({
  family: 'System',
  size: {
    s: 14,
    m: 17,
    true: 17,
    l: 17,
    xl: 17,
  },
  lineHeight: {
    s: 22,
  },
  weight: {
    s: '400',
  },
  letterSpacing: {
    s: 0,
  },
});

export const monoFont = createFont({
  family: 'Menlo-Regular',
  size: {
    s: 14,
    m: 14,
    true: 15,
    l: 15,
    xl: 15,
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
  heading: sfFont,
  body: sfFont,
  mono: monoFont,
  // ===
};

export const config = createTamagui({
  tokens,
  fonts,
  themes,
  settings: {
    allowedStyleValues: 'somewhat-strict',
  },
  defaultProps: {
    Input: {
      borderColor: '$border',
      borderColorFocus: '$borderFocus',
    },
    TextInput: {
      borderColor: '$border',
      borderColorFocus: '$borderFocus',
    },
  },
  animations,
});

type AppConfig = typeof config;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export function TamaguiProvider({children}: {children: React.ReactNode}) {
  return <BaseTamaguiProvider config={config}>{children}</BaseTamaguiProvider>;
}
