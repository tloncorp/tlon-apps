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
import { DESKTOP_SIDEBAR_WIDTH, useGlobalSearch } from '../../ui';
import { HomeDrawerParamList } from '../types';
import { ChannelStack } from './ChannelStack';
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
  if (focusedRoute.params && 'channelId' in focusedRoute.params) {
    return <MessagesSidebar focusedChannelId={focusedRoute.params.channelId} />;
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

function Empty() {
  return <View backgroundColor="$secondaryBackground" flex={1} />;
}
