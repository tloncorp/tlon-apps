import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useLayoutEffect } from 'react';

/**
 * Installs screen-owned navigation options and removes them on unmount. The
 * focus guard prevents an exiting screen from resetting the next screen's
 * options during a native transition.
 */
export function useInstalledNavigationOptions(
  navigation: NavigationProp<ParamListBase> | undefined,
  options: object,
  resetOptions: object,
  enabled = true
) {
  useLayoutEffect(() => {
    if (!enabled || !navigation) {
      return;
    }

    navigation.setOptions(options);
  }, [enabled, navigation, options]);

  useLayoutEffect(() => {
    if (!enabled || !navigation) {
      return;
    }

    return () => {
      if (navigation.isFocused == null || navigation.isFocused()) {
        navigation.setOptions(resetOptions);
      }
    };
  }, [enabled, navigation, resetOptions]);
}
