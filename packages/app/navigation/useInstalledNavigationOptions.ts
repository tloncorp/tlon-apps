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

    let routeIsBeingRemoved = false;
    const unsubscribeBeforeRemove = navigation.addListener(
      'beforeRemove',
      () => {
        routeIsBeingRemoved = true;
      }
    );

    return () => {
      unsubscribeBeforeRemove();

      // Route options disappear with the route. Resetting them while native
      // stack is animating that route away makes the outgoing header jump.
      if (
        !routeIsBeingRemoved &&
        (navigation.isFocused == null || navigation.isFocused())
      ) {
        navigation.setOptions(resetOptions);
      }
    };
  }, [enabled, navigation, resetOptions]);
}
