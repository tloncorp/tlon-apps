import {
  type NavigationProp,
  NavigationRouteContext,
  type ParamListBase,
} from '@react-navigation/native';
import { useContext, useLayoutEffect } from 'react';

/** Installs screen-owned options on the route that owns the native header. */
export function useInstalledNavigationOptions(
  navigation: NavigationProp<ParamListBase> | undefined,
  options: object,
  enabled = true,
  resetOptions?: object
) {
  const routeKey = useContext(NavigationRouteContext)?.key;
  const isTopLevelSection = navigation?.getState().type === 'tab';
  // Top-level sections share the root stack's navigation bar with pushed screens.
  // Installing on the parent keeps one native header alive for the transition.
  const optionsNavigation = isTopLevelSection
    ? navigation?.getParent()
    : navigation;

  useLayoutEffect(() => {
    if (!enabled || !optionsNavigation) {
      return;
    }

    const installOptions = () => optionsNavigation.setOptions(options);
    // Check the selected tab rather than `isFocused()`, which is false while a
    // pushed screen covers the tabs. Tabs that mount there (a reset straight
    // into a channel) would otherwise leave the header on its route name
    // until the user comes back.
    const isSelectedTab = () => {
      const state = navigation?.getState();
      return state?.routes[state.index]?.key === routeKey;
    };
    if (!isTopLevelSection || isSelectedTab()) {
      installOptions();
    }

    // Sections stay mounted after their first visit, so restore each section's
    // options when it becomes active instead of letting a stale one win.
    if (isTopLevelSection && navigation) {
      return navigation.addListener('focus', installOptions);
    }
  }, [
    enabled,
    isTopLevelSection,
    navigation,
    options,
    optionsNavigation,
    routeKey,
  ]);

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
