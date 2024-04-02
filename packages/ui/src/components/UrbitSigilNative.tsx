// Note: we must import sigil from @urbit/sigil-js/dist/core
// because core was built as a separate entry point for non-browser environments
import sigil from '@urbit/sigil-js/dist/core';
import { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { View } from 'tamagui';

export const UrbitSigilNative = View.styleable<{
  ship: string;
  foregroundColor: string;
  adjustedColor: string;
}>(({ ship, foregroundColor, adjustedColor, ...props }, ref) => {
  const validShip = ship.length <= 14; // planet or larger
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
