import {
  NavigatorScreenParams,
  RouteProp,
  useNavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { storage } from '@tloncorp/shared/db';
import { memo, useEffect, useMemo, useRef } from 'react';

import { useRenderCount } from '../hooks/useRenderCount';
import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import {
  CombinedParamList,
  RootDrawerParamList,
  RootStackParamList,
} from './types';
import { useRootNavigation, useTypedReset } from './utils';

export type MobileBasePathStackParamList = {
  Root: NavigatorScreenParams<RootStackParamList>;
};

export type DesktopBasePathStackParamList = {
  Root: NavigatorScreenParams<RootDrawerParamList>;
};

const MobileBasePathStackNavigator =
  createNativeStackNavigator<MobileBasePathStackParamList>();
const DesktopBasePathStackNavigator =
  createNativeStackNavigator<DesktopBasePathStackParamList>();

/**
 * On web, this is necessary for navigation to work properly when the base URL
 * is something other than `/`, eg `/apps/groups/`
 */
export const BasePathNavigator = memo(({ isMobile }: { isMobile: boolean }) => {
  const Navigator = isMobile
    ? MobileBasePathStackNavigator
    : DesktopBasePathStackNavigator;

  const navStateIndex = useNavigationState((state) => state?.index);
  const navStateRoutes = useNavigationState((state) => state?.routes);
  const currentRoute = useMemo(
    () =>
      navStateIndex && navStateRoutes ? navStateRoutes[navStateIndex] : null,
    [navStateIndex, navStateRoutes]
  );
  const rootState = useMemo(() => currentRoute?.state, [currentRoute]);
  const rootStateIndex = useMemo(() => rootState?.index, [rootState]);
  const rootStateRoutes = useMemo(() => rootState?.routes, [rootState]);
  const lastWasMobile = useRef(isMobile);

  const currentScreenAndParams = useMemo(() => {
    if (!rootStateIndex || !rootStateRoutes) {
      return undefined;
    }
    if (isMobile !== lastWasMobile.current) {
      return undefined;
    }

    const isHome = rootStateIndex === 0 && rootStateRoutes[0].name === 'Home';
    const isContacts =
      rootStateIndex === 2 && rootStateRoutes[2].name === 'Contacts';
    if (isHome) {
      const homeState = rootStateRoutes[0].state;
      if (!homeState || homeState.index === undefined) {
        return {
          name: 'Home',
          params: {},
        };
      }
      // capture the current screen and params within the home tab
      return {
        name: homeState.routes[homeState.index].name,
        params: homeState.routes[homeState.index].params,
      };
    }

    if (isContacts) {
      // contacts tab is the third tab
      const contactsState = rootStateRoutes[2].state;
      if (!contactsState || contactsState.index === undefined) {
        return {
          name: 'Contacts',
          params: {},
        };
      }
      return {
        name: contactsState.routes[contactsState.index].name,
        params: contactsState.routes[contactsState.index].params,
      };
    }

    const screen = rootStateRoutes[rootStateIndex];
    return {
      name: screen.name,
      params: screen.params,
    };
  }, [isMobile, rootStateIndex, rootStateRoutes]);

  const { resetToChannel } = useRootNavigation();
  const reset = useTypedReset();

  useEffect(() => {
    // if we're switching between mobile and desktop, we want to reset the
    // navigator to the last screen that was open in the other mode
    if (lastWasMobile.current !== isMobile) {
      setTimeout(() => {
        getLastScreen().then((lastScreen) => {
          if (!lastScreen) {
            return;
          }

          if (
            lastScreen.name === 'Channel' ||
            lastScreen.name === 'GroupDM' ||
            lastScreen.name === 'DM'
          ) {
            resetToChannel(lastScreen.params?.channelId, {
              groupId: lastScreen.params?.groupId,
            });
          } else if (isMobile && lastScreen.name === 'Home') {
            reset([{ name: 'ChatList' }]);
          }
          if (isMobile && lastScreen.name === 'Settings') {
            // if we're on mobile and the last screen was profile, we want to
            // be able to go back to the contacts screen when we press back
            reset([{ name: 'Contacts' }, { name: 'Settings' }]);
          } else {
            reset([lastScreen]);
          }

          lastWasMobile.current = isMobile;
        });
      }, 1); // tiny delay to let navigator mount. otherwise it doesn't work.
    }
  }, [isMobile, resetToChannel, reset]);

  const prevScreenAndParamsRef = useRef<typeof currentScreenAndParams>();

  useEffect(() => {
    if (currentScreenAndParams && isMobile === lastWasMobile.current) {
      if (
        JSON.stringify(prevScreenAndParamsRef.current) !==
        JSON.stringify(currentScreenAndParams)
      ) {
        prevScreenAndParamsRef.current = currentScreenAndParams;
        storage.lastScreen.setValue(currentScreenAndParams);
      }
    }
  }, [currentScreenAndParams, isMobile]);

  const component = useMemo(() => {
    if (isMobile) {
      return RootStack;
    }
    return TopLevelDrawer;
  }, [isMobile]);

  useRenderCount('BasePathNavigator');

  return (
    <Navigator.Navigator screenOptions={{ headerShown: false }}>
      <Navigator.Screen name="Root" component={component} />
    </Navigator.Navigator>
  );
});

BasePathNavigator.displayName = 'BasePathNavigator';

export const getLastScreen = storage.lastScreen
  .getValue as () => Promise<null | RouteProp<CombinedParamList, any>>;
