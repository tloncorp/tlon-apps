// Note: we must import sigil from @urbit/sigil-js/dist/core
// because core was built as a separate entry point for non-browser environments
import { utils } from '@tloncorp/shared';
import sigil from '@urbit/sigil-js/dist/core';
import { darken, lighten, parseToHsla } from 'color2k';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { SvgXml } from 'react-native-svg';
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
  const colorScheme = useColorScheme();
  const colorIsFullHex = color?.startsWith('#') && color?.length === 7;
  const adjustedColor = useMemo(
    () =>
      themeAdjustColor(
        utils.normalizeUrbitColor(
          // TODO: Figure out where '#0' comes from
          !colorIsFullHex ? '#000000' : color ?? '#000000'
        ),
        colorScheme ?? 'light'
      ),
    [color, colorScheme]
  );

  const foregroundColor = useMemo(
    () => foregroundFromBackground(adjustedColor),
    [adjustedColor]
  );

  const validShip = ship.length <= 14; // planet or larger
  const theme = useTheme();
  const sigilXml = useMemo(
    () =>
      validShip
        ? sigil({
            point: ship,
            detail: 'none',
            size: 12,
            space: 'none',
            foreground: foregroundColor,
            background: adjustedColor,
          })
        : null,
    [ship]
  );
  return (
    <View
      ref={ref}
      // TODO: Should be variables/props, not hardcoded values
      width={20}
      height={20}
      alignItems="center"
      justifyContent="center"
      style={{
        backgroundColor: adjustedColor,
      }}
      borderRadius="$2xs"
      {...props}
    >
      {sigilXml && <SvgXml xml={sigilXml} />}
    </View>
  );
});
