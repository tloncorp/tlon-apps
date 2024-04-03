// Note: the import statement for sigil is different in the native version
// The native version uses the core entry point of sigil-js
// The web version uses the default entry point of sigil-js
import sigil from '@urbit/sigil-js';
import { useMemo } from 'react';
// import { SvgXml } from 'react-native-svg';
import { View } from 'tamagui';

const UrbitSigilWeb = View.styleable<{
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
      {/* TODO: get the svg to render on web
       including this now breaks the vite build
      sigilXml && <SvgXml xml={sigilXml} />
      */}
    </View>
  );
});

export default UrbitSigilWeb;
