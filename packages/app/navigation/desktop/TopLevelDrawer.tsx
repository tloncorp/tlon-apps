import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { DrawerNavigationState } from '@react-navigation/native';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVariableValue, useTheme } from 'tamagui';

import { GlobalSearch } from '../../features/chat-list/GlobalSearch';
import useBrowserNotifications from '../../hooks/useBrowserNotifications';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import {
  useAgentGroupOnboardingLock,
  useAnyAgentGroupOnboardingLock,
} from '../../hooks/useAgentGroupOnboardingLock';
import {
  AvatarNavIcon,
  GlobalSearchProvider,
  NavIcon,
  YStack,
  useGlobalSearch,
  useWebAppUpdate,
} from '../../ui';
import { PersonalInviteSheet } from '../../ui/components/PersonalInviteSheet';
import { RootDrawerParamList } from '../types';
import { getActiveNestedGroupId } from '../routeHelpers';
import { useRootNavigation } from '../utils';
import { PaneSafeAreaProvider } from './PaneSafeAreaProvider';
import { useSplitPaneWidths } from './splitPaneWidths';
import { ActivityNavigator } from './ActivityNavigator';
import { HomeNavigator } from './HomeNavigator';
import { MessagesNavigator } from './MessagesNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { SettingsNavigator } from './SettingsNavigator';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const DrawerContent = (props: DrawerContentComponentProps) => {
  const insets = useSafeAreaInsets();
  const { railStrip } = useSplitPaneWidths();
  const userId = useCurrentUserId();
  // const { data: baseUnread } = store.useBaseUnread();
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const { webAppNeedsUpdate, triggerWebAppUpdate } = useWebAppUpdate();
  const lastHomeStateRef =
    useRef<DrawerNavigationState<RootDrawerParamList> | null>(null);
  const { isOpen, setIsOpen } = useGlobalSearch();
  const [personalInviteOpen, setPersonalInviteOpen] = useState(false);
  const activeGroupId = getActiveNestedGroupId(props.state);
  const {
    locked: agentOnboardingLocked,
    isLoading: agentOnboardingLockLoading,
  } = useAgentGroupOnboardingLock(activeGroupId);
  const navigationDisabled =
    agentOnboardingLocked ||
    Boolean(activeGroupId && agentOnboardingLockLoading);

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

  const trackTabSelection = (tab: keyof RootDrawerParamList) => {
    if (!isRouteActive(tab)) {
      trackEvent(AnalyticsEvent.NavigationTabSelected, { tab });
    }
  };

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
    <YStack
      paddingVertical="$l"
      marginBottom={insets.bottom}
      {...(railStrip
        ? {
            position: 'absolute',
            top: railStrip.top,
            bottom: 0,
            left: railStrip.x,
            width: railStrip.width,
          }
        : { flex: 1, marginTop: insets.top, marginLeft: insets.left })}
    >
      <YStack
        gap="$xl"
        alignItems="center"
        pointerEvents={navigationDisabled ? 'none' : 'auto'}
      >
        <NavIcon
          type="Home"
          activeType="HomeFilled"
          isActive={isRouteActive('Home')}
          // hasUnreads={(unreadCount?.channels ?? 0) > 0}
          // intentionally leave undotted for now
          shouldShowUnreads={false}
          disabled={navigationDisabled}
          onPress={() => {
            trackTabSelection('Home');
            restoreHomeState();
          }}
          testID="HomeNavIcon"
        />
        <NavIcon
          type="Messages"
          activeType="MessagesFilled"
          isActive={isRouteActive('Messages')}
          shouldShowUnreads={false}
          disabled={navigationDisabled}
          onPress={() => {
            trackTabSelection('Messages');
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
          disabled={navigationDisabled}
          onPress={() => {
            trackTabSelection('Activity');
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
          disabled={navigationDisabled}
          onPress={() => {
            trackTabSelection('Contacts');
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
            disabled={navigationDisabled}
          />
        )}
      </YStack>
      <YStack
        gap="$xl"
        marginTop="auto"
        alignItems="center"
        pointerEvents={navigationDisabled ? 'none' : 'auto'}
      >
        <NavIcon
          type="AddPerson"
          isActive={false}
          shouldShowUnreads={false}
          disabled={navigationDisabled}
          onPress={handlePersonalInvitePress}
          testID="PersonalInviteNavIcon"
        />
        <NavIcon
          type="Settings"
          testID="SettingsNavIcon"
          isActive={isRouteActive('Settings')}
          shouldShowUnreads={false}
          disabled={navigationDisabled}
          onPress={() => {
            trackTabSelection('Settings');
            saveHomeState();
            props.navigation.reset({
              index: 0,
              routes: [{ name: 'Settings' }],
            });
          }}
        />
        {Platform.OS === 'web' ? (
          <NavIcon
            type="Command"
            isActive={isOpen}
            shouldShowUnreads={false}
            disabled={navigationDisabled}
            onPress={() => setIsOpen(!isOpen)}
          />
        ) : null}
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
  // This must stay below GlobalSearchProvider so notification navigation uses
  // the user's actual last-open desktop tab instead of the context default.
  useBrowserNotifications();
  const { navigateToGroup, navigateToChannel } = useRootNavigation();
  const {
    locked: agentOnboardingLocked,
    isLoading: agentOnboardingLockLoading,
  } = useAnyAgentGroupOnboardingLock();
  const { railColumnWidth, railStrip } = useSplitPaneWidths();

  return (
    <>
      {/* Keyboard-driven and DOM-positioned; native has no Cmd-K. */}
      {Platform.OS === 'web' ? (
        <GlobalSearch
          navigateToGroup={navigateToGroup}
          navigateToChannel={navigateToChannel}
          disabled={agentOnboardingLocked || agentOnboardingLockLoading}
        />
      ) : null}
      <Drawer.Navigator
        drawerContent={(props: DrawerContentComponentProps) => {
          return (
            <PaneSafeAreaProvider touchesLeft touchesRight={false}>
              <DrawerContent {...props} />
            </PaneSafeAreaProvider>
          );
        }}
        initialRouteName="Home"
        screenOptions={{
          drawerType: 'permanent',
          headerShown: false,
          drawerStyle: {
            width: railColumnWidth,
            backgroundColor: getVariableValue(useTheme().background),
            borderRightColor: getVariableValue(useTheme().border),
            ...(railStrip ? { borderRightWidth: 0 } : null),
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
