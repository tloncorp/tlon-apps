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
  const isTabScreen = navigation?.getState().type === 'tab';
  // Top-level tabs share the root stack's navigation bar with pushed screens.
  // Installing on the parent keeps one native header alive for the transition.
  const optionsNavigation = isTabScreen ? navigation?.getParent() : navigation;

  useLayoutEffect(() => {
    if (!enabled || !optionsNavigation) {
      return;
    }

    const installOptions = () => optionsNavigation.setOptions(options);
    if (!isTabScreen || navigation?.isFocused()) {
      installOptions();
    }

    // Native tabs remain mounted after their first visit, so restore each
    // tab's options when it becomes active instead of letting a stale tab win.
    if (isTabScreen && navigation) {
      return navigation.addListener('focus', installOptions);
    }
  }, [enabled, isTabScreen, navigation, options, optionsNavigation]);

  useLayoutEffect(() => {
    if (!enabled || !navigation || !optionsNavigation) {
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
        optionsNavigation.setOptions(resetOptions);
      }
    };
  }, [enabled, navigation, optionsNavigation, resetOptions]);
}
