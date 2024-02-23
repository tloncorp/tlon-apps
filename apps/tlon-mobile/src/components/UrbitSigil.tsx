import sigil from '@urbit/sigil-js/dist/core';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTailwind } from 'tailwind-rn';

import { useIsDarkMode } from '../hooks/useIsDarkMode';

type Props = {
  ship: string;
};

export const UrbitSigil = ({ ship }: Props) => {
  const tailwind = useTailwind();
  const isDarkMode = useIsDarkMode();

  const sigilXml = useMemo(
    () =>
      sigil({
        point: ship,
        detail: 'none',
        size: 12,
        space: 'none',
        foreground: '#ffffff',
        background: isDarkMode ? '#333333' : '#000000',
      }),
    [ship, isDarkMode]
  );

  return (
    <View
      style={tailwind(
        'p-1.5 h-5 w-5 rounded flex items-center justify-center bg-black dark:bg-tlon-black-80'
      )}
    >
      <SvgXml xml={sigilXml} />
    </View>
  );
};
