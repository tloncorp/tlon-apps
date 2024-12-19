import {
  NavigatorScreenParams,
  useNavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef } from 'react';

import { getLastScreen, setLastScreen } from '../utils/lastScreen';
import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import { RootDrawerParamList, RootStackParamList } from './types';
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
export function BasePathNavigator({ isMobile }: { isMobile: boolean }) {
  const Navigator = isMobile
    ? MobileBasePathStackNavigator
    : DesktopBasePathStackNavigator;

  const navState = useNavigationState((state) => state);
  const currentRoute = navState?.routes[navState.index];
  const rootState = currentRoute?.state;
  const lastWasMobile = useRef(isMobile);

  const currentScreenAndParams = useMemo(() => {
    if (isMobile !== lastWasMobile.current) {
      return undefined;
    }

    const isHome =
      rootState?.index === 0 && rootState?.routes[0].name === 'Home';
    const isContacts =
      rootState?.index === 2 && rootState?.routes[2].name === 'Contacts';
    if (isHome) {
      const homeState = rootState.routes[0].state;
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
      const contactsState = rootState.routes[2].state;
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

    if (rootState && rootState.routes && rootState.index !== undefined) {
      const screen = rootState.routes[rootState.index];
      return {
        name: screen.name,
        params: screen.params,
      };
    }

    return undefined;
  }, [isMobile, rootState]);

  const { resetToChannel } = useRootNavigation();
  const reset = useTypedReset();

  useEffect(() => {
    const lastScreen = async () => getLastScreen();

    // if we're switching between mobile and desktop, we want to reset the
    // navigator to the last screen that was open in the other mode
    if (lastWasMobile.current !== isMobile) {
      setTimeout(() => {
        lastScreen().then((lastScreen) => {
          if (!lastScreen) {
            return;
          }

          if (
            lastScreen.name === 'Channel' ||
            lastScreen.name === 'GroupDM' ||
            lastScreen.name === 'DM'
          ) {
            resetToChannel(lastScreen.params.channelId, {
              groupId: lastScreen.params.groupId,
            });
          } else if (isMobile && lastScreen.name === 'Home') {
            reset([{ name: 'ChatList' }]);
          }
          if (isMobile && lastScreen.name === 'Profile') {
            // if we're on mobile and the last screen was profile, we want to
            // be able to go back to the contacts screen when we press back
            reset([{ name: 'Contacts' }, { name: 'Profile' }]);
          } else {
            reset([lastScreen]);
          }

          lastWasMobile.current = isMobile;
        });
      }, 1); // tiny delay to let navigator mount. otherwise it doesn't work.
    }
  }, [isMobile, resetToChannel, rootState, reset]);

  useEffect(() => {
    if (currentScreenAndParams && isMobile === lastWasMobile.current) {
      setLastScreen(currentScreenAndParams);
    }
  }, [currentScreenAndParams, isMobile]);

  return (
    <Navigator.Navigator screenOptions={{ headerShown: false }}>
      <Navigator.Screen
        name="Root"
        component={isMobile ? RootStack : TopLevelDrawer}
      />
    </Navigator.Navigator>
  );
}
