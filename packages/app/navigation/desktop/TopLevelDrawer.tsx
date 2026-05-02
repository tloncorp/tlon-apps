import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { DrawerNavigationState } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  Image,
  Pressable,
  Text,
  getDarkColor,
  isLightColor,
} from '@tloncorp/ui';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ScrollView, Square, View, getVariableValue, useTheme } from 'tamagui';

import { GlobalSearch } from '../../features/chat-list/GlobalSearch';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import {
  useCloseApp,
  useFocusedDesk,
  useOpenApps,
} from '../../hooks/useOpenApps';
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
import { AppsNavigator } from './AppsNavigator';
import { HomeNavigator } from './HomeNavigator';
import { MessagesNavigator } from './MessagesNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { SettingsNavigator } from './SettingsNavigator';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const APP_TILE_SIZE = 32;
const CLOSE_BUTTON_SIZE = 14;
const isWeb = Platform.OS === 'web';
const TITLE_DARK = '#1f2937';
const TITLE_LIGHT = '#e5e7eb';
const blendStyle = isWeb
  ? ({ mixBlendMode: 'hard-light' } as { mixBlendMode: 'hard-light' })
  : undefined;

function OpenAppNavIcon({
  app,
  isActive,
  onPress,
  onClose,
}: {
  app: store.InstalledApp;
  isActive: boolean;
  onPress: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lightBg = app.color ? isLightColor(app.color) : true;
  const fallbackInitialColor = app.color ? getDarkColor(app.color) : 'white';
  const initialColor = isWeb
    ? lightBg
      ? TITLE_DARK
      : TITLE_LIGHT
    : fallbackInitialColor;
  return (
    <View
      position="relative"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Pressable
        onPress={onPress}
        hoverStyle={{ opacity: 0.85 }}
        pressStyle={{ opacity: 0.7 }}
        borderRadius="$s"
      >
        <Square
          size={APP_TILE_SIZE}
          borderRadius="$s"
          overflow="hidden"
          backgroundColor={app.color || '$secondaryBackground'}
          borderWidth={2}
          borderColor={isActive ? '$blue' : 'transparent'}
          alignItems="center"
          justifyContent="center"
        >
          {app.image ? (
            <Image
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              width="100%"
              height="100%"
              source={{ uri: app.image }}
              contentFit="cover"
            />
          ) : (
            <Text
              size="$label/m"
              fontWeight="600"
              color={initialColor}
              style={blendStyle}
            >
              {app.title.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </Square>
      </Pressable>
      {hovered && (
        <Pressable
          onPress={onClose}
          position="absolute"
          bottom={-2}
          right={-2}
          width={CLOSE_BUTTON_SIZE}
          height={CLOSE_BUTTON_SIZE}
          borderRadius={CLOSE_BUTTON_SIZE / 2}
          backgroundColor="$primaryText"
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.7 }}
        >
          <Text size="$label/s" color="$background" lineHeight={CLOSE_BUTTON_SIZE}>
            ×
          </Text>
        </Pressable>
      )}
    </View>
  );
}

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

  const openAppDesks = useOpenApps();
  const closeApp = useCloseApp();
  const { data: installedApps = [] } = store.useInstalledApps();
  const openAppEntries = useMemo(() => {
    return openAppDesks
      .map((desk) => installedApps.find((a) => a.desk === desk))
      .filter((a): a is store.InstalledApp => !!a);
  }, [openAppDesks, installedApps]);

  // Driven by AppViewerScreen's useFocusEffect — more reliable than reading
  // the nested drawer state, which doesn't always reflect changes made via
  // navigation calls from outside the drawer (e.g. from Leap).
  const activeDesk = useFocusedDesk();

  const goToOpenApp = useCallback(
    (desk: string) => {
      saveHomeState();
      props.navigation.navigate('Apps', {
        screen: 'AppViewer',
        params: { desk },
      });
    },
    [props.navigation, saveHomeState]
  );

  const handleCloseApp = useCallback(
    (desk: string) => {
      closeApp(desk);
      // If the closed app was the focused screen, fall back to the launcher.
      if (activeDesk === desk) {
        props.navigation.navigate('Apps', { screen: 'AppLauncher' });
      }
    },
    [closeApp, activeDesk, props.navigation]
  );

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
        <NavIcon
          type="Discover"
          isActive={isRouteActive('Apps') && !activeDesk}
          shouldShowUnreads={false}
          testID="AppsNavIcon"
          onPress={() => {
            saveHomeState();
            // Explicit nested navigation pops any open AppViewer back to
            // the launcher so the icon's active state matches what's
            // actually rendered.
            props.navigation.navigate('Apps', { screen: 'AppLauncher' });
          }}
        />
      </YStack>
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingTop: 16 }}
      >
        <YStack gap="$xl" alignItems="center">
          {openAppEntries.map((app) => (
            <OpenAppNavIcon
              key={app.desk}
              app={app}
              isActive={isRouteActive('Apps') && activeDesk === app.desk}
              onPress={() => goToOpenApp(app.desk)}
              onClose={() => handleCloseApp(app.desk)}
            />
          ))}
        </YStack>
      </ScrollView>
      <YStack gap="$xl" alignItems="center">
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
        <Drawer.Screen name="Apps" component={AppsNavigator} />
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
