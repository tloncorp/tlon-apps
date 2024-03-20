import { createAnimations } from "@tamagui/animations-moti";
import { createFont, createTamagui, createTokens } from "tamagui";

export const animations = createAnimations({
  simple: {
    type: "timing",
    duration: 100,
  },
  quick: {
    type: "spring",
    damping: 30,
    mass: 1,
    stiffness: 250,
  },
});

export const tokens = createTokens({
  color: {
    translucentBlack: "rgba(0, 0, 0, 0.2)",
    black: "#000000",
    gray900: "#1A1A1A",
    gray800: "#333333",
    gray700: "#4C4C4C",
    gray600: "#666666",
    gray500: "#808080",
    gray400: "#999999",
    gray300: "#B3B3B3",
    gray200: "#CCCCCC",
    gray100: "#E5E5E5",
    gray50: "#F5F5F5",
    white: "#FFFFFF",
    red: "#FF6240",
    orange: "#FF9040",
    yellow: "#FADE7A",
    green: "#2AD546",
    blue: "#008EFF",
    indigo: "#615FD3",
    redSoft: "#FFEFEC",
    orangeSoft: "#FFF4EC",
    yellowSoft: "#FAF5D9",
    greenSoft: "#EAFBEC",
    blueSoft: "#E5F4FF",
    indigoSoft: "#EFEFFB",
  },
  space: {
    "2xs": 2,
    xs: 4,
    s: 6,
    m: 8,
    l: 12,
    xl: 16,
    true: 16,
    "2xl": 24,
    "3xl": 32,
    "4xl": 48,
  },
  size: {
    "2xs": 2,
    xs: 4,
    s: 6,
    m: 8,
    l: 12,
    xl: 16,
    true: 16,
    "2xl": 24,
    "3xl": 32,
    "4xl": 48,
  },
  radius: {
    "2xs": 2,
    xs: 4,
    s: 6,
    m: 8,
    l: 12,
    xl: 16,
    true: 16,
    "2xl": 24,
    "3xl": 32,
    "4xl": 48,
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
  dark: {
    primaryText: "#FFFFFF",
    secondaryText: "#B3B3B3",
    background: "#1A1818",
    secondaryBackground: "#322E2E",
    tertiaryText: "#808080",
    border: "#333333",
    activeBorder: "#4C4C4C",
    positiveActionText: "#4E91F5",
    positiveBackground: "#143A5E",
    positiveBorder: "#3D567C",
    negativeActionText: "#E96A6A",
    negativeBackground: "#4B2525",
    negativeBorder: "#814444",
    darkBackground: "#4C4C4C",
  },
  light: {
    primaryText: "#1A1818",
    secondaryText: "#666666",
    background: "#FFFFFF",
    secondaryBackground: "#F5F5F5",
    tertiaryText: "#999999",
    border: "#E5E5E5",
    activeBorder: "#CCCCCC",
    positiveActionText: "#3B80E8",
    positiveBackground: "#F5FAFF",
    positiveBorder: "#CCDCF3",
    negativeActionText: "#E22A2A",
    negativeBackground: "#FEF5F5",
    negativeBorder: "#FCD0D0",
    darkBackground: "#333333",
  },
};

export const systemFont = createFont({
  family:
    "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
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
    s: "400",
    m: "500",
  },
  letterSpacing: {
    s: 0,
  },
});

export const monoFont = createFont({
  family: "Menlo-Regular",
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
    l: "200",
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
  // ===
};

export const config = createTamagui({
  tokens,
  fonts,
  themes,
  settings: {
    allowedStyleValues: "somewhat-strict",
  },
  // Different versions of a transitive dependency are conflicting for the AnimationDriver,
  // ignore the warning for now
  // @ts-ignore
  animations,
});
