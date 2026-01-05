import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/routers';
import { isEqual } from 'lodash';
import { memo, useEffect } from 'react';
import { View, getVariableValue, useTheme } from 'tamagui';

import { ChatDetailsScreen } from '../../features/top/ChatDetailsScreen';
import { ChatVolumeScreen } from '../../features/top/ChatVolumeScreen';
import { GroupChannelsScreenContent } from '../../features/top/GroupChannelsScreen';
import { DESKTOP_SIDEBAR_WIDTH, useGlobalSearch } from '../../ui';
import { HomeDrawerParamList } from '../types';
import { ChannelStack } from './ChannelStack';
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
    return <HomeSidebar />;
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

function Empty() {
  return <View backgroundColor="$secondaryBackground" flex={1} />;
}
