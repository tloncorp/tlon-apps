import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/routers';

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
      initialRouteName="MainContent"
      screenOptions={{
        drawerType: 'permanent',
        headerShown: false,
      }}
    >
      <HomeDrawer.Screen name="ChatList" component={Empty} />
      <HomeDrawer.Screen name="GroupChannels" component={Empty} />
      <HomeDrawer.Screen name="Channel" component={ChannelStack} />
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
    return <GroupChannelsScreenContent groupId={focusedRoute.params.groupId} />;
  } else {
    return <ChatListScreenView />;
  }
}

const ChannelStackNavigator = createNativeStackNavigator();

function ChannelStack(
  props: NativeStackScreenProps<HomeDrawerParamList, 'Channel'>
) {
  return (
    <ChannelStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ChannelStackNavigator.Screen
        name="ChannelRoot"
        component={ChannelScreen}
        initialParams={props.route.params}
        navigationKey={props.route.params.channelId}
      />
      <ChannelStackNavigator.Screen
        name="GroupSettings"
        component={GroupSettingsStack}
      />
      <ChannelStackNavigator.Screen
        name="ChannelSearch"
        component={ChannelSearchScreen}
      />
      <ChannelStackNavigator.Screen name="Post" component={PostScreen} />
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
    </ChannelStackNavigator.Navigator>
  );
}

function Empty() {
  return null;
}
