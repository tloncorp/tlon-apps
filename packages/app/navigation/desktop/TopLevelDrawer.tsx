import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { DrawerNavigationState } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useRef, useState } from 'react';
import { getVariableValue, useTheme } from 'tamagui';

import { GlobalSearch } from '../../features/chat-list/GlobalSearch';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import {
  AvatarNavIcon,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
  GlobalSearchProvider,
  NavIcon,
  YStack,
  useGlobalSearch,
  useWebAppUpdate,
} from '../../ui';
import { PersonalInviteSheet } from '../../ui/components/PersonalInviteSheet';
import { RootDrawerParamList } from '../types';
import { useRootNavigation } from '../utils';
import { ActivityNavigator } from './ActivityNavigator';
import { HomeNavigator } from './HomeNavigator';
import { MessagesNavigator } from './MessagesNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { SettingsNavigator } from './SettingsNavigator';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const DrawerContent = (props: DrawerContentComponentProps) => {
  const userId = useCurrentUserId();
  // const { data: baseUnread } = store.useBaseUnread();
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const { webAppNeedsUpdate, triggerWebAppUpdate } = useWebAppUpdate();
  const lastHomeStateRef =
    useRef<DrawerNavigationState<RootDrawerParamList> | null>(null);
  const { isOpen, setIsOpen } = useGlobalSearch();
  const [personalInviteOpen, setPersonalInviteOpen] = useState(false);

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
      const currentScreenIsHome = isRouteActive('Home');
      if (currentScreenIsHome) {
        // If already on Home, just reset navigation state
        props.navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        return;
      }

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
  }, [props.navigation, isRouteActive]);

  const handlePersonalInvitePress = useCallback(() => {
    db.hasViewedPersonalInvite.setValue(true);
    setPersonalInviteOpen(true);
  }, []);

  return (
    <YStack flex={1} paddingVertical="$l">
      <YStack gap="$xl" alignItems="center">
        <NavIcon
          type="Home"
          activeType="HomeFilled"
          isActive={isRouteActive('Home')}
          // hasUnreads={(unreadCount?.channels ?? 0) > 0}
          // intentionally leave undotted for now
          shouldShowUnreads={false}
          onPress={restoreHomeState}
          testID="HomeNavIcon"
        />
        <NavIcon
          type="Messages"
          activeType="MessagesFilled"
          isActive={isRouteActive('Messages')}
          shouldShowUnreads={false}
          onPress={() => {
            saveHomeState();
            props.navigation.reset({
              index: 0,
              routes: [{ name: 'Messages' }],
            });
          }}
          testID="MessagesNavIcon"
        />
        <NavIcon
          type="Notifications"
          activeType="NotificationsFilled"
          hasUnreads={haveUnreadUnseenActivity}
          isActive={isRouteActive('Activity')}
          testID="ActivityNavIcon"
          onPress={() => {
            saveHomeState();
            props.navigation.reset({
              index: 0,
              routes: [{ name: 'Activity' }],
            });
          }}
        />
        <AvatarNavIcon
          id={userId}
          focused={isRouteActive('Contacts')}
          onPress={() => {
            saveHomeState();
            props.navigation.reset({
              index: 0,
              routes: [{ name: 'Contacts' }],
            });
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
      <YStack gap="$xl" marginTop="auto" alignItems="center">
        <NavIcon
          type="AddPerson"
          isActive={false}
          shouldShowUnreads={false}
          onPress={handlePersonalInvitePress}
          testID="PersonalInviteNavIcon"
        />
        <NavIcon
          type="Settings"
          testID="SettingsNavIcon"
          isActive={isRouteActive('Settings')}
          shouldShowUnreads={false}
          onPress={() => {
            saveHomeState();
            props.navigation.reset({
              index: 0,
              routes: [{ name: 'Settings' }],
            });
          }}
        />
        <NavIcon
          type="Command"
          isActive={isOpen}
          shouldShowUnreads={false}
          onPress={() => setIsOpen(!isOpen)}
        />
      </YStack>
      <PersonalInviteSheet
        open={personalInviteOpen}
        onOpenChange={() => setPersonalInviteOpen(false)}
        onPressInviteFriends={handlePersonalInvitePress}
      />
    </YStack>
  );
};

const TopLevelDrawerInner = () => {
  const { navigateToGroup, navigateToChannel } = useRootNavigation();

  return (
    <>
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
            width: DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
            backgroundColor: getVariableValue(useTheme().background),
            borderRightColor: getVariableValue(useTheme().border),
          },
        }}
      >
        <Drawer.Screen name="Home" component={HomeNavigator} />
        <Drawer.Screen name="Messages" component={MessagesNavigator} />
        <Drawer.Screen name="Activity" component={ActivityNavigator} />
        <Drawer.Screen name="Contacts" component={ProfileNavigator} />
        <Drawer.Screen name="Settings" component={SettingsNavigator} />
      </Drawer.Navigator>
    </>
  );
};

export const TopLevelDrawer = () => {
  return (
    <GlobalSearchProvider>
      <TopLevelDrawerInner />
    </GlobalSearchProvider>
  );
};
