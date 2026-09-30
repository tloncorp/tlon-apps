import { darken, hsla, lighten, parseToHsla, parseToRgba } from 'color2k';
import { useMemo } from 'react';
import { ThemeName, useThemeName } from 'tamagui';

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
  // Sub-themes (e.g. `dark_ownMessage`) keep their parent's scheme.
  const scheme = theme.split('_')[0];

  if (lightness <= 0.2 && scheme === 'dark') {
    return lighten(color, 0.2 - lightness);
  }

  if (lightness >= 0.8 && scheme === 'light') {
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
