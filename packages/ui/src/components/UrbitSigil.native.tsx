// Note: we must import sigil from @urbit/sigil-js/dist/core
// because core was built as a separate entry point for non-browser environments
import { utils } from '@tloncorp/shared';
import sigil from '@urbit/sigil-js/dist/core';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { View, useStyle } from 'tamagui';

import {
  UrbitSigilBase,
  foregroundFromBackground,
  themeAdjustColor,
} from './UrbitSigilBase';

const UrbitSigil = View.styleable<{
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

  const styles = useStyle(props, {
    resolveValues: 'value',
  });
  const size = typeof styles.width === 'number' ? styles.width / 2 : 12;

  const validShip = ship.length <= 14; // planet or larger
  const sigilXml = useMemo(
    () =>
      validShip
        ? sigil({
            point: ship,
            detail: 'none',
            size: size,
            space: 'none',
            foreground: foregroundColor,
            background: adjustedColor,
          })
        : null,
    [ship]
  );
  return (
    <UrbitSigilBase ship={ship} adjustedColor={adjustedColor} {...props}>
      {sigilXml && <SvgXml shouldRasterizeIOS={true} xml={sigilXml} />}
    </UrbitSigilBase>
  );
});

export default UrbitSigil;
