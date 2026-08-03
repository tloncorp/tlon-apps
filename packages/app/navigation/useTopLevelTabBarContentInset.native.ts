import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { getTopLevelTabBarContentInset } from './topLevelTabBarMetrics';

export function useTopLevelTabBarContentInset() {
  const insets = useSafeAreaInsets();

  // Experimental native tabs do not expose their measured height yet. Keep
  // the platform estimate centralized until React Navigation provides it.
  return getTopLevelTabBarContentInset(
    Platform.OS,
    insets.bottom,
    getTokenValue('$l', 'space')
  );
}
