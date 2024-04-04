import { utils } from '@tloncorp/shared';
import { darken, lighten, parseToHsla } from 'color2k';
import React, { Suspense, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { View, isWeb, useTheme } from 'tamagui';

const UrbitSigilWeb = React.lazy(() => import('./UrbitSigilWeb.web'));
const UrbitSigilNative = React.lazy(() => import('./UrbitSigilNative.native'));

const SuspendedUrbitSigilWeb = ({
  ref,
  ship,
  foregroundColor,
  adjustedColor,
  ...props
}: {
  ref: any;
  ship: string;
  foregroundColor: 'black' | 'white';
  adjustedColor: string;
}) => (
  <Suspense fallback={<View />}>
    <UrbitSigilWeb
      ref={ref}
      ship={ship}
      adjustedColor={adjustedColor}
      foregroundColor={foregroundColor}
      {...props}
    />
  </Suspense>
);

const SuspendedUrbitSigilNative = ({
  ref,
  ship,
  foregroundColor,
  adjustedColor,
  ...props
}: {
  ref: any;
  ship: string;
  foregroundColor: 'black' | 'white';
  adjustedColor: string;
}) => (
  <Suspense fallback={<View />}>
    <UrbitSigilNative
      ref={ref}
      ship={ship}
      adjustedColor={adjustedColor}
      foregroundColor={foregroundColor}
      {...props}
    />
  </Suspense>
);

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

  if (isWeb) {
    // we need to do this so that we only import the web version of the sigil
    // if we're on the web
    return (
      <SuspendedUrbitSigilWeb
        ref={ref}
        ship={ship}
        foregroundColor={foregroundColor}
        adjustedColor={adjustedColor}
        {...props}
      />
    );
  }

  return (
    <SuspendedUrbitSigilNative
      ref={ref}
      ship={ship}
      foregroundColor={foregroundColor}
      adjustedColor={adjustedColor}
      {...props}
    />
  );
});
