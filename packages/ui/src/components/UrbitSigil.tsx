// Note: the import statement for sigil is different in the native version
// The native version uses the core entry point of sigil-js
// The web version uses the default entry point of sigil-js
import sigil from '@urbit/sigil-js';
import { useMemo } from 'react';
import { useTheme, View } from 'tamagui';

export const UrbitSigil = View.styleable<{
  ship: string;
}>(({ ship, ...props }, ref) => {
  const validShip = ship.length <= 14; // planet or larger
  const theme = useTheme();
  const sigilXml = useMemo(
    () =>
      sigil({
        point: ship,
        detail: 'none',
        size: 12,
        space: 'none',
        foreground: '#ffffff',
        // typescript thinks theme.darkBackground could be undefined
        background: theme.darkBackground?.val
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
      backgroundColor="$darkBackground"
      borderRadius="$2xs"
      {...props}
    />
  );
});
