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
import ImageViewerScreen from '../../features/top/ImageViewerScreen';
import PostScreen from '../../features/top/PostScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { DESKTOP_SIDEBAR_WIDTH, useGlobalSearch } from '../../ui';
import { GroupSettingsStack } from '../GroupSettingsStack';
import { HomeDrawerParamList } from '../types';
import { getChannelId } from '../utils';
import { MessagesSidebar } from './MessagesSidebar';

const MessagesDrawer = createDrawerNavigator();

export const MessagesNavigator = () => {
  const theme = useTheme();
  const { setLastOpenTab } = useGlobalSearch();
  const backgroundColor = getVariableValue(theme.background);
  const borderColor = getVariableValue(theme.border);

  useEffect(() => {
    setLastOpenTab('Messages');
  }, []);

  return (
    <MessagesDrawer.Navigator
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
      <MessagesDrawer.Screen name="ChatList" component={MainStack} />
      <MessagesDrawer.Screen name="GroupChannels" component={Empty} />
      <MessagesDrawer.Screen name="Channel" component={ChannelStack} />
      <MessagesDrawer.Screen name="DM" component={ChannelStack} />
      <MessagesDrawer.Screen name="GroupDM" component={ChannelStack} />
      <MessagesDrawer.Screen name="ChatVolume" component={ChatVolumeScreen} />
      <MessagesDrawer.Screen name="ChatDetails" component={ChatDetailsScreen} />
    </MessagesDrawer.Navigator>
  );
};

const DrawerContent = memo((props: DrawerContentComponentProps) => {
  const state = props.state as NavigationState<HomeDrawerParamList>;
  const focusedRoute = state.routes[props.state.index];
  
  const channelId = getChannelId(focusedRoute);
  
  if (channelId && channelId !== '') {
    return <MessagesSidebar focusedChannelId={channelId} />;
  } else {
    return <MessagesSidebar />;
  }
}, isEqual);

DrawerContent.displayName = 'MessagesSidebarDrawerContent';

const MainStackNavigator = createNativeStackNavigator();

function MainStack() {
  return (
    <MainStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Messages"
    >
      <MainStackNavigator.Screen name="Messages" component={Empty} />
    </MainStackNavigator.Navigator>
  );
}

const ChannelStackNavigator = createNativeStackNavigator();

function ChannelStack(
  props: NativeStackScreenProps<HomeDrawerParamList, 'Channel'>
) {
  // eslint-disable-next-line no-restricted-syntax
  const initialParams = props.route.params;
  const navKey = () => {
    const channelId = getChannelId(props.route);
    return channelId || 'none';
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
          initialParams={initialParams}
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
          initialParams={initialParams}
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
