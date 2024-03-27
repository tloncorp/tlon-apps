// Note: we must import sigil from @urbit/sigil-js/dist/core
// because core was built as a separate entry point for non-browser environments
import sigil from '@urbit/sigil-js/dist/core';
import { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { useTheme, View } from 'tamagui';

export const UrbitSigil = View.styleable<{
  ship: string;
}>(({ ship, ...props }, ref) => {
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
            // TODO: Should correctly set the foreground based on the background
            foreground: '#ffffff',
            background: theme.darkBackground.val,
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
      backgroundColor="$darkBackground"
      borderRadius="$2xs"
      {...props}
    >
      {sigilXml && <SvgXml xml={sigilXml} />}
    </View>
  );
});
