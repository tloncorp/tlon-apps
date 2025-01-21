import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { DrawerNavigationState } from '@react-navigation/native';
import * as store from '@tloncorp/shared/store';
import {
  AvatarNavIcon,
  GlobalSearch,
  GlobalSearchProvider,
  NavIcon,
  YStack,
  useWebAppUpdate,
} from '@tloncorp/ui';
import { useCallback, useRef } from 'react';
import { getVariableValue, useTheme } from 'tamagui';

import { ActivityScreen } from '../../features/top/ActivityScreen';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootDrawerParamList } from '../types';
import { useRootNavigation } from '../utils';
import { HomeNavigator } from './HomeNavigator';
import { ProfileScreenNavigator } from './ProfileScreenNavigator';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const DrawerContent = (props: DrawerContentComponentProps) => {
  const userId = useCurrentUserId();
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const { webAppNeedsUpdate, triggerWebAppUpdate } = useWebAppUpdate();
  const lastHomeStateRef =
    useRef<DrawerNavigationState<RootDrawerParamList> | null>(null);

  const isRouteActive = useCallback(
    (routeName: keyof RootDrawerParamList) => {
      return (
        props.state.index ===
        props.state.routes.findIndex((r) => r.name === routeName)
      );
    },
    [props.state]
  );

  const saveHomeState = useCallback(() => {
    if (isRouteActive('Home')) {
      lastHomeStateRef.current =
        props.state as DrawerNavigationState<RootDrawerParamList>;
    }
  }, [props.state, isRouteActive]);

  const restoreHomeState = useCallback(() => {
    try {
      if (lastHomeStateRef.current) {
        props.navigation.reset(lastHomeStateRef.current);
      } else {
        // Default state if no saved state exists
        props.navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    } catch (error) {
      console.error('Error restoring Home navigation state:', error);
      // Fallback to default state if restoration fails
      props.navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [props.navigation]);

  return (
    <YStack gap="$l">
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive('Home')}
        // hasUnreads={(unreadCount?.channels ?? 0) > 0}
        // intentionally leave undotted for now
        hasUnreads={false}
        onPress={restoreHomeState}
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={haveUnreadUnseenActivity}
        isActive={isRouteActive('Activity')}
        onPress={() => {
          saveHomeState();
          props.navigation.reset({ index: 0, routes: [{ name: 'Activity' }] });
        }}
      />
      <AvatarNavIcon
        id={userId}
        focused={isRouteActive('Contacts')}
        onPress={() => {
          saveHomeState();
          props.navigation.reset({ index: 0, routes: [{ name: 'Contacts' }] });
        }}
      />
      {webAppNeedsUpdate && (
        <NavIcon
          backgroundColor="$yellow"
          type="Bang"
          isActive={true}
          onPress={triggerWebAppUpdate}
          shouldShowUnreads={false}
        />
      )}
    </YStack>
  );
};

export const TopLevelDrawer = () => {
  const { navigateToGroup, navigateToChannel } = useRootNavigation();

  return (
    <GlobalSearchProvider>
      <GlobalSearch
        navigateToGroup={navigateToGroup}
        navigateToChannel={navigateToChannel}
      />
      <Drawer.Navigator
        drawerContent={(props: DrawerContentComponentProps) => {
          return <DrawerContent {...props} />;
        }}
        initialRouteName="Home"
        screenOptions={{
          drawerType: 'permanent',
          headerShown: false,
          drawerStyle: {
            width: 48,
            backgroundColor: getVariableValue(useTheme().background),
            borderRightColor: getVariableValue(useTheme().border),
          },
        }}
      >
        <Drawer.Screen name="Home" component={HomeNavigator} />
        <Drawer.Screen name="Activity" component={ActivityScreen} />
        <Drawer.Screen name="Contacts" component={ProfileScreenNavigator} />
      </Drawer.Navigator>
    </GlobalSearchProvider>
  );
};
