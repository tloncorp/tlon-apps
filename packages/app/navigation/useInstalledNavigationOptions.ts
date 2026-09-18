import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useLayoutEffect } from 'react';

/** Installs screen-owned options on the route that owns the native header. */
export function useInstalledNavigationOptions(
  navigation: NavigationProp<ParamListBase> | undefined,
  options: object,
  enabled = true,
  resetOptions?: object
) {
  const isTopLevelSection = navigation?.getState().type === 'tab';
  // The top-level sections share the root stack's navigation bar with pushed
  // screens. Installing on the parent keeps one native header alive for the
  // transition.
  const optionsNavigation = isTopLevelSection
    ? navigation?.getParent()
    : navigation;

  useLayoutEffect(() => {
    if (!enabled || !optionsNavigation) {
      return;
    }

    const installOptions = () => optionsNavigation.setOptions(options);
    if (!isTopLevelSection || navigation?.isFocused()) {
      installOptions();
    }

    // Sections stay mounted after their first visit, so restore each section's
    // options when it becomes active instead of letting a stale one win.
    if (isTopLevelSection && navigation) {
      return navigation.addListener('focus', installOptions);
    }
  }, [enabled, isTopLevelSection, navigation, options, optionsNavigation]);

  useLayoutEffect(() => {
    if (!enabled || !navigation || !optionsNavigation || !resetOptions) {
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
