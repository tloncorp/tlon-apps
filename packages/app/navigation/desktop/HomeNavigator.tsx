import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/routers';
import { View, getVariableValue, useTheme } from 'tamagui';

import { ChannelMembersScreen } from '../../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../../features/channels/ChannelMetaScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import ChannelScreen from '../../features/top/ChannelScreen';
import ChannelSearchScreen from '../../features/top/ChannelSearchScreen';
import { ChatListScreenView } from '../../features/top/ChatListScreen';
import { GroupChannelsScreenContent } from '../../features/top/GroupChannelsScreen';
import ImageViewerScreen from '../../features/top/ImageViewerScreen';
import PostScreen from '../../features/top/PostScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { GroupSettingsStack } from '../../navigation/GroupSettingsStack';
import { HomeDrawerParamList } from '../types';

const HomeDrawer = createDrawerNavigator();

export const HomeNavigator = () => {
  return (
    <HomeDrawer.Navigator
      drawerContent={DrawerContent}
      initialRouteName="ChatList"
      screenOptions={{
        drawerType: 'permanent',
        headerShown: false,
        drawerStyle: {
          width: 340,
          backgroundColor: getVariableValue(useTheme().background),
        },
      }}
    >
      <HomeDrawer.Screen name="ChatList" component={MainStack} />
      <HomeDrawer.Screen name="GroupChannels" component={Empty} />
      <HomeDrawer.Screen name="Channel" component={ChannelStack} />
      <HomeDrawer.Screen name="DM" component={ChannelStack} />
      <HomeDrawer.Screen name="GroupDM" component={ChannelStack} />
    </HomeDrawer.Navigator>
  );
};

function DrawerContent(props: DrawerContentComponentProps) {
  const state = props.state as NavigationState<HomeDrawerParamList>;
  const focusedRoute = state.routes[props.state.index];
  if (
    focusedRoute.params &&
    'groupId' in focusedRoute.params &&
    focusedRoute.params.groupId
  ) {
    if ('channelId' in focusedRoute.params) {
      return (
        <GroupChannelsScreenContent
          groupId={focusedRoute.params.groupId}
          focusedChannelId={focusedRoute.params.channelId}
        />
      );
    }
    return <GroupChannelsScreenContent groupId={focusedRoute.params.groupId} />;
  } else if (
    // This accounts for the case where we've navigated to a screen within the ChannelSack.
    focusedRoute.params &&
    'params' in focusedRoute.params &&
    focusedRoute.params.params &&
    'groupId' in focusedRoute.params.params &&
    focusedRoute.params.params.groupId
  ) {
    if ('channelId' in focusedRoute.params.params) {
      return (
        <GroupChannelsScreenContent
          groupId={focusedRoute.params.params.groupId}
          focusedChannelId={focusedRoute.params.params.channelId}
        />
      );
    }
    return (
      <GroupChannelsScreenContent
        // @ts-expect-error - groupId is guaranteed to be in focusedRoute.
        groupId={focusedRoute.params.params.groupId}
      />
    );
  } else if (focusedRoute.params && 'channelId' in focusedRoute.params) {
    return (
      <ChatListScreenView focusedChannelId={focusedRoute.params.channelId} />
    );
  } else {
    return <ChatListScreenView />;
  }
}

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
    if ('channelId' in props.route.params) {
      return props.route.params.channelId;
    }
    if (props.route.params.params && 'channelId' in props.route.params.params) {
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
