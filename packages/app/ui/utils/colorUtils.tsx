import { darken, hsla, lighten, parseToHsla, parseToRgba } from 'color2k';
import { useMemo } from 'react';
import { useTheme } from 'tamagui';
import { ThemeName, useThemeName } from 'tamagui';

export function getFallbackSigilColor(seed: string): string {
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const hue = hash % 360;
  return `hsl(${hue}, 65%, 48%)`;
}

export const useSigilColors = (accentColor: string | null = '#000000') => {
  const theme = useThemeName();
  const backgroundColor = useMemo(
    () => adjustColorContrastForTheme(accentColor || '#000000', theme),
    [accentColor, theme]
  );
  const foregroundColor = useMemo(
    () => getContrastingColor(backgroundColor),
    [backgroundColor]
  );
  return {
    foregroundColor,
    backgroundColor,
  };
};

export const getContrastingColor = (background: string): 'black' | 'white' => {
  const rgb = parseInputAsRgba(background);
  const brightness = (299 * rgb[0] + 587 * rgb[1] + 114 * rgb[2]) / 1000;
  const whiteBrightness = 255;
  return whiteBrightness - brightness < 70 ? 'black' : 'white';
};

export function adjustColorContrastForTheme(
  color: string,
  theme: ThemeName
): string {
  const hslaColor = parseInputAsHsla(color);
  const lightness = hslaColor[2];

  if (lightness <= 0.2 && theme === 'dark') {
    return lighten(color, 0.2 - lightness);
  }

  if (lightness >= 0.8 && theme === 'light') {
    return darken(color, lightness - 0.8);
  }

  return hsla(...hslaColor);
}

function parseInputAsHsla(color: string): [number, number, number, number] {
  try {
    return parseToHsla(color);
  } catch (e) {
    return [0, 0, 0, 1];
  }
}

function parseInputAsRgba(color: string): [number, number, number, number] {
  try {
    return parseToRgba(color);
  } catch (e) {
    return [0, 0, 0, 1];
  }
}

export const isDarkBg = (hexValue: string): boolean => {
  const r = parseInt(hexValue.slice(1, 3), 16);
  const g = parseInt(hexValue.slice(3, 5), 16);
  const b = parseInt(hexValue.slice(5, 7), 16);

  return r * 0.299 + g * 0.587 + b * 0.114 < 186;
};

export const useIsDarkTheme = (): boolean => {
  const theme = useTheme();
  return isDarkBg(theme.background?.val);
};
