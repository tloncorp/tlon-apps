import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { DrawerNavigationState } from '@react-navigation/native';
import { getDurableClient } from '@tloncorp/api/client/durable';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ConfirmDialog, useToast } from '@tloncorp/ui';
import { useCallback, useRef, useState } from 'react';
import { getVariableValue, useTheme } from 'tamagui';

import { GlobalSearch } from '../../features/chat-list/GlobalSearch';
import useBrowserNotifications from '../../hooks/useBrowserNotifications';
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
import { getMainGroupRoute } from '../utils';
import { getDesktopChannelRoute, getDesktopPostRoute } from '../routeHelpers';
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

  const durable = getDurableClient();
  const toast = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const exportAccount = useCallback(async () => {
    if (!durable) return;
    const owned = durable.bootstrap.groups
      .filter(
        (group) =>
          group.groupId &&
          group.hosted !== false &&
          !group.unavailable &&
          !group.lobby &&
          group.owner === durable.user
      )
      .map((group) => group.groupId!);
    try {
      await durable.exportBundle(owned);
      window.location.assign('/apps/groups/?identities=1');
    } catch (error) {
      toast({ message: String(error), duration: 5000 });
    }
  }, [durable, toast]);

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
          />
        )}
      </YStack>
      <YStack gap="$xl" marginTop="auto" alignItems="center">
        {durable && (
          <NavIcon
            type="LogOut"
            isActive={exportOpen}
            shouldShowUnreads={false}
            onPress={() => setExportOpen(true)}
            testID="ExportAccountNavIcon"
          />
        )}
        {/* A durable server has no invite links. */}
        {durable ? null : (
          <NavIcon
            type="AddPerson"
            isActive={false}
            shouldShowUnreads={false}
            onPress={handlePersonalInvitePress}
            testID="PersonalInviteNavIcon"
          />
        )}
        <NavIcon
          type="Settings"
          testID="SettingsNavIcon"
          isActive={isRouteActive('Settings')}
          shouldShowUnreads={false}
          onPress={() => {
            trackTabSelection('Settings');
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
      {durable ? null : (
        <PersonalInviteSheet
          open={personalInviteOpen}
          onOpenChange={() => setPersonalInviteOpen(false)}
          onPressInviteFriends={handlePersonalInvitePress}
        />
      )}
      <ConfirmDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export your account?"
        description="This downloads your account and the groups you own as a bundle. They go offline here until you import the bundle on another server. Anyone with the file can take your account, so keep it private."
        confirmText="Export"
        destructive
        onConfirm={() => void exportAccount()}
      />
    </YStack>
  );
};

const TopLevelDrawerInner = () => {
  // This must stay below GlobalSearchProvider so notification navigation uses
  // the user's actual last-open desktop tab instead of the context default.
  useBrowserNotifications();
  const { lastOpenTab } = useGlobalSearch();
  const drawerNavigation = useRef<
    DrawerContentComponentProps['navigation'] | null
  >(null);
  const navigateToGroup = useCallback(async (id: string) => {
    drawerNavigation.current!.navigate(await getMainGroupRoute(id, false));
  }, []);
  const navigateToChannel = useCallback(
    (channel: db.Channel, selectedPostId?: string) => {
      drawerNavigation.current!.navigate(
        getDesktopChannelRoute(
          lastOpenTab,
          channel.id,
          channel.groupId ?? undefined,
          selectedPostId
        )
      );
    },
    [lastOpenTab]
  );
  const navigateToPost = useCallback(
    (post: db.Post, selectedPostId?: string) => {
      drawerNavigation.current!.navigate(
        getDesktopPostRoute(lastOpenTab, {
          postId: post.id,
          authorId: post.authorId,
          channelId: post.channelId,
          groupId: post.groupId ?? undefined,
          selectedPostId,
        })
      );
    },
    [lastOpenTab]
  );

  return (
    <>
      <GlobalSearch
        navigateToGroup={navigateToGroup}
        navigateToChannel={navigateToChannel}
        navigateToPost={navigateToPost}
      />
      <Drawer.Navigator
        drawerContent={(props: DrawerContentComponentProps) => {
          drawerNavigation.current = props.navigation;
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
