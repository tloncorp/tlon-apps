// Note: the import statement for sigil is different in the native version
// The native version uses the core entry point of sigil-js
// The web version uses the default entry point of sigil-js
import { utils } from '@tloncorp/shared';
import sigil from '@urbit/sigil-js';
import { darken, lighten, parseToHsla } from 'color2k';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { View, useTheme } from 'tamagui';

function foregroundFromBackground(background: string): 'black' | 'white' {
  const rgb = {
    r: parseInt(background.slice(1, 3), 16),
    g: parseInt(background.slice(3, 5), 16),
    b: parseInt(background.slice(5, 7), 16),
  };
  const brightness = (299 * rgb.r + 587 * rgb.g + 114 * rgb.b) / 1000;
  const whiteBrightness = 255;

  return whiteBrightness - brightness < 70 ? 'black' : 'white';
}
function themeAdjustColor(color: string, theme: 'light' | 'dark'): string {
  const hsla = parseToHsla(color);
  const lightness = hsla[2];

  if (lightness <= 0.2 && theme === 'dark') {
    return lighten(color, 0.2 - lightness);
  }

  if (lightness >= 0.8 && theme === 'light') {
    return darken(color, lightness - 0.8);
  }

  return color;
}

export const UrbitSigil = View.styleable<{
  ship: string;
  color?: string;
}>(({ ship, color, ...props }, ref) => {
  const validShip = ship.length <= 14; // planet or larger
  const colorScheme = useColorScheme();

  const adjustedColor = useMemo(
    () =>
      themeAdjustColor(
        utils.normalizeUrbitColor(color ?? '#000000'),
        colorScheme ?? 'light'
      ),
    [color, colorScheme]
  );

  const foregroundColor = useMemo(
    () => foregroundFromBackground(adjustedColor),
    [adjustedColor]
  );
  const sigilXml = useMemo(
    () =>
      sigil({
        point: ship,
        detail: 'none',
        size: 12,
        space: 'none',
        foreground: foregroundColor,
        background: adjustedColor,
      }),
    [ship]
  );
  return (
    <View
      ref={ref}
      width={20}
      height={20}
      alignItems="center"
      justifyContent="center"
      style={{
        backgroundColor: adjustedColor,
      }}
      borderRadius="$2xs"
      {...props}
    />
  );
});
