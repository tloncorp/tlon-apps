import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/routers';
import { isEqual } from 'lodash';
import { memo, useEffect } from 'react';
import { View, getVariableValue, useTheme } from 'tamagui';

import { ChannelMembersScreen } from '../../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../../features/channels/ChannelMetaScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import ChannelScreen from '../../features/top/ChannelScreen';
import ChannelSearchScreen from '../../features/top/ChannelSearchScreen';
import { ChatDetailsScreen } from '../../features/top/ChatDetailsScreen';
import { ChatVolumeScreen } from '../../features/top/ChatVolumeScreen';
import { GroupChannelsScreenContent } from '../../features/top/GroupChannelsScreen';
import ImageViewerScreen from '../../features/top/ImageViewerScreen';
import PostScreen from '../../features/top/PostScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { GroupSettingsStack } from '../../navigation/GroupSettingsStack';
import { DESKTOP_SIDEBAR_WIDTH, useGlobalSearch } from '../../ui';
import { HomeDrawerParamList } from '../types';
import { HomeSidebar } from './HomeSidebar';

const HomeDrawer = createDrawerNavigator();

export const HomeNavigator = () => {
  const theme = useTheme();
  const { setLastOpenTab } = useGlobalSearch();
  const backgroundColor = getVariableValue(theme.background);
  const borderColor = getVariableValue(theme.border);

  useEffect(() => {
    setLastOpenTab('Home');
  }, []);

  return (
    <HomeDrawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      initialRouteName="ChatList"
      screenOptions={() => {
        return {
          drawerType: 'permanent',
          headerShown: false,
          drawerStyle: {
            width: DESKTOP_SIDEBAR_WIDTH,
            backgroundColor,
            borderRightColor: borderColor,
          },
        };
      }}
    >
      <HomeDrawer.Screen name="ChatList" component={MainStack} />
      <HomeDrawer.Screen name="GroupChannels" component={Empty} />
      <HomeDrawer.Screen name="Channel" component={ChannelStack} />
      <HomeDrawer.Screen name="DM" component={ChannelStack} />
      <HomeDrawer.Screen name="GroupDM" component={ChannelStack} />
      <HomeDrawer.Screen name="ChatVolume" component={ChatVolumeScreen} />
      <HomeDrawer.Screen name="ChatDetails" component={ChatDetailsScreen} />
    </HomeDrawer.Navigator>
  );
};

const DrawerContent = memo((props: DrawerContentComponentProps) => {
  const state = props.state as NavigationState<HomeDrawerParamList>;
  const focusedRoute = state.routes[props.state.index];
  const focusedRouteParams = focusedRoute.params;
  // @ts-expect-error - nested params is not in the type
  const nestedFocusedRouteParams = focusedRouteParams?.params;

  // Extract the current groupId for highlighting
  let currentGroupId: string | undefined;
  let isDMRoute = false;

  // Check if we're viewing a channel that belongs to a group
  if (
    focusedRoute.name === 'Channel' ||
    focusedRoute.name === 'DM' ||
    focusedRoute.name === 'GroupDM'
  ) {
    isDMRoute = focusedRoute.name === 'DM' || focusedRoute.name === 'GroupDM';

    // For these routes, check if there's a groupId in the params structure
    if (
      focusedRouteParams &&
      typeof focusedRouteParams === 'object' &&
      'params' in focusedRouteParams
    ) {
      const innerParams = focusedRouteParams.params;
      if (
        innerParams &&
        typeof innerParams === 'object' &&
        'params' in innerParams
      ) {
        const deepParams = innerParams.params;
        if (deepParams && 'groupId' in deepParams && deepParams.groupId) {
          currentGroupId = deepParams.groupId as string;
        }
      } else if (
        innerParams &&
        'groupId' in innerParams &&
        innerParams.groupId
      ) {
        currentGroupId = innerParams.groupId as string;
      }
    }
  }

  if (
    focusedRouteParams &&
    'groupId' in focusedRouteParams &&
    focusedRouteParams.groupId
  ) {
    currentGroupId = focusedRouteParams.groupId;
  } else if (
    focusedRouteParams &&
    nestedFocusedRouteParams &&
    'groupId' in nestedFocusedRouteParams
  ) {
    currentGroupId = nestedFocusedRouteParams.groupId;
  }

  // Extract the focused channel ID
  let focusedChannelId: string | undefined;
  if (focusedRoute.params && 'channelId' in focusedRoute.params) {
    focusedChannelId = focusedRoute.params.channelId;
  } else if (
    focusedRouteParams &&
    focusedRoute.name === 'ChatDetails' &&
    'chatId' in focusedRouteParams &&
    'chatType' in focusedRouteParams &&
    focusedRouteParams.chatType === 'channel'
  ) {
    focusedChannelId = focusedRouteParams.chatId;
  }

  // Determine if we should show compact mode
  // Show compact mode when viewing a group, but not when viewing a DM
  const shouldShowCompactMode = currentGroupId && !isDMRoute;

  if (shouldShowCompactMode) {
    // Show compact mode with group channels
    return (
      <View flex={1} flexDirection="row">
        <HomeSidebar
          compact
          currentGroupId={currentGroupId!}
          focusedChannelId={focusedChannelId}
        />
        <GroupChannelsScreenContent
          groupId={currentGroupId!}
          focusedChannelId={focusedChannelId}
        />
      </View>
    );
  }

  // Otherwise, show the full home sidebar
  // This includes when viewing DMs (even if they were accessed from within a group)
  return <HomeSidebar focusedChannelId={focusedChannelId} />;
}, isEqual);

DrawerContent.displayName = 'HomeSidebarDrawerContent';

const MainStackNavigator = createNativeStackNavigator();

function MainStack() {
  return (
    <MainStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Home"
    >
      <MainStackNavigator.Screen name="Home" component={Empty} />
    </MainStackNavigator.Navigator>
  );
}

const ChannelStackNavigator = createNativeStackNavigator();

function ChannelStack(
  props: NativeStackScreenProps<HomeDrawerParamList, 'Channel'>
) {
  const navKey = () => {
    if (props.route.params && 'channelId' in props.route.params) {
      return props.route.params.channelId;
    }
    if (
      props.route.params &&
      props.route.params.params &&
      'channelId' in props.route.params.params
    ) {
      return props.route.params.params.channelId;
    }

    return 'none';
  };

  return (
    <ChannelStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="ChannelRoot"
    >
      <ChannelStackNavigator.Group navigationKey={navKey()}>
        <ChannelStackNavigator.Screen
          name="ChannelRoot"
          component={ChannelScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="GroupSettings"
          component={GroupSettingsStack}
        />
        <ChannelStackNavigator.Screen
          name="ChannelSearch"
          component={ChannelSearchScreen}
        />
        <ChannelStackNavigator.Screen
          name="Post"
          component={PostScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="ImageViewer"
          component={ImageViewerScreen}
        />
        <ChannelStackNavigator.Screen
          name="UserProfile"
          component={UserProfileScreen}
        />
        <ChannelStackNavigator.Screen
          name="EditProfile"
          component={EditProfileScreen}
        />
        <ChannelStackNavigator.Screen
          name="ChannelMembers"
          component={ChannelMembersScreen}
        />
        <ChannelStackNavigator.Screen
          name="ChannelMeta"
          component={ChannelMetaScreen}
        />
      </ChannelStackNavigator.Group>
    </ChannelStackNavigator.Navigator>
  );
}

function Empty() {
  return <View backgroundColor="$secondaryBackground" flex={1} />;
}
