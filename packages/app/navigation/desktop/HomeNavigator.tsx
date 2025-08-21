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

import { InviteUsersScreen } from '../../features/InviteUsersScreen';
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
      return <HomeSidebar focusedChannelId={focusedRouteParams.chatId} />;
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
      <MainStackNavigator.Screen
        name="InviteUsers"
        component={InviteUsersScreen}
      />
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
        <ChannelStackNavigator.Screen
          name="InviteUsers"
          component={InviteUsersScreen}
        />
      </ChannelStackNavigator.Group>
    </ChannelStackNavigator.Navigator>
  );
}

function Empty() {
  return <View backgroundColor="$secondaryBackground" flex={1} />;
}
