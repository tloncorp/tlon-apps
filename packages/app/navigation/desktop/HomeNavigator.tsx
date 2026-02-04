import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/routers';
import { createDevLogger } from '@tloncorp/shared';
import { isEqual } from 'lodash';
import { memo, useEffect, useRef } from 'react';
import { getVariableValue, useTheme } from 'tamagui';

import { ChannelMembersScreen } from '../../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../../features/channels/ChannelMetaScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import ChannelScreen from '../../features/top/ChannelScreen';
import ChannelSearchScreen from '../../features/top/ChannelSearchScreen';
import { ChatDetailsScreen } from '../../features/top/ChatDetailsScreen';
import { ChatVolumeScreen } from '../../features/top/ChatVolumeScreen';
import { HomeEmptyState } from '../../features/top/DesktopEmptyStates';
import { GroupChannelsScreenContent } from '../../features/top/GroupChannelsScreen';
import ImageViewerScreen from '../../features/top/ImageViewerScreen';
import PostScreen from '../../features/top/PostScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { GroupSettingsStack } from '../../navigation/GroupSettingsStack';
import { DESKTOP_SIDEBAR_WIDTH, useGlobalSearch } from '../../ui';
import { HomeDrawerParamList } from '../types';
import { HomeSidebar } from './HomeSidebar';

const logger = createDevLogger('HomeNavigator', true);

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

  // Extract channelId and groupId for logging
  const channelId =
    (focusedRouteParams && 'channelId' in focusedRouteParams
      ? focusedRouteParams.channelId
      : undefined) ??
    (nestedFocusedRouteParams && 'channelId' in nestedFocusedRouteParams
      ? nestedFocusedRouteParams.channelId
      : undefined);
  const groupId =
    (focusedRouteParams && 'groupId' in focusedRouteParams
      ? focusedRouteParams.groupId
      : undefined) ??
    (nestedFocusedRouteParams && 'groupId' in nestedFocusedRouteParams
      ? nestedFocusedRouteParams.groupId
      : undefined);

  logger.log(
    `DrawerContent render | routeName=${focusedRoute.name} | channelId=${channelId ?? 'none'} | groupId=${groupId ?? 'none'} | stateIndex=${state.index}`
  );

  if (
    focusedRouteParams &&
    'groupId' in focusedRouteParams &&
    focusedRouteParams.groupId
  ) {
    if ('channelId' in focusedRouteParams) {
      return (
        <GroupChannelsScreenContent
          groupId={focusedRouteParams.groupId}
          focusedChannelId={focusedRouteParams.channelId}
        />
      );
    }
    return <GroupChannelsScreenContent groupId={focusedRouteParams.groupId} />;
  } else if (
    focusedRouteParams &&
    nestedFocusedRouteParams &&
    'groupId' in nestedFocusedRouteParams
  ) {
    if ('channelId' in nestedFocusedRouteParams) {
      return (
        <GroupChannelsScreenContent
          groupId={nestedFocusedRouteParams.groupId}
          focusedChannelId={nestedFocusedRouteParams.channelId}
        />
      );
    }
    return (
      <GroupChannelsScreenContent groupId={nestedFocusedRouteParams.groupId} />
    );
  } else if (
    focusedRouteParams &&
    focusedRoute.name === 'ChatDetails' &&
    'chatId' in focusedRouteParams &&
    'chatType' in focusedRouteParams
  ) {
    if (focusedRouteParams.chatType === 'channel') {
      // If groupId is provided, show the group's channel list in the sidebar
      if ('groupId' in focusedRouteParams && focusedRouteParams.groupId) {
        return (
          <GroupChannelsScreenContent
            groupId={focusedRouteParams.groupId as string}
            focusedChannelId={focusedRouteParams.chatId as string}
          />
        );
      }
      return <HomeSidebar focusedChannelId={focusedRouteParams.chatId as string} />;
    } else if (focusedRouteParams.chatType === 'group') {
      return <GroupChannelsScreenContent groupId={focusedRouteParams.chatId} />;
    }
  } else if (focusedRoute.params && 'channelId' in focusedRoute.params) {
    return <HomeSidebar focusedChannelId={focusedRoute.params.channelId} />;
  } else if (focusedRoute.params && 'previewGroupId' in focusedRoute.params) {
    return <HomeSidebar previewGroupId={focusedRoute.params.previewGroupId} />;
  } else {
    return <HomeSidebar />;
  }
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

  const channelId = navKey();
  const prevChannelIdRef = useRef(channelId);

  useEffect(() => {
    logger.log(
      `ChannelStack render | channelId=${channelId} | prevChannelId=${prevChannelIdRef.current} | routeName=${props.route.name}`
    );
    if (channelId !== prevChannelIdRef.current) {
      logger.log(
        `ChannelStack channelId CHANGED | from=${prevChannelIdRef.current} | to=${channelId}`
      );
      prevChannelIdRef.current = channelId;
    }
  }, [channelId, props.route.name]);

  // Log on mount/unmount
  useEffect(() => {
    const initialChannelId = prevChannelIdRef.current;
    logger.log(`ChannelStack MOUNT | channelId=${initialChannelId}`);
    return () => {
      logger.log(
        `ChannelStack UNMOUNT | initialChannelId=${initialChannelId} | currentChannelId=${prevChannelIdRef.current}`
      );
    };
  }, []);

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
  return <HomeEmptyState />;
}
