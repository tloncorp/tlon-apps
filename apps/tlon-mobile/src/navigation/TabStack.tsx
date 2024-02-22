import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  ActivityFilled,
  ActivityOutlined,
  HomeFilled,
  HomeOutlined,
  MessagesFilled,
  MessagesOutlined,
} from '../../assets/icons';
import { WebviewProvider } from '../contexts/webview';
import type { TabParamList } from '../types';
import { WebViewStack, WebviewSingletonStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

const ICON_SIZE = {
  width: 20,
  height: 20,
};

export const TabStack = () => (
  <WebviewProvider>
    <Tab.Navigator
      id="TabBar"
      initialRouteName="Groups"
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Groups"
        component={WebViewStack}
        initialParams={{ initialPath: '/' }}
        options={{
          tabBarIcon: ({ focused }) =>
            focused ? (
              <HomeFilled {...ICON_SIZE} />
            ) : (
              <HomeOutlined {...ICON_SIZE} />
            ),
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={WebViewStack}
        initialParams={{ initialPath: '/messages' }}
        options={{
          tabBarIcon: ({ focused }) =>
            focused ? (
              <MessagesFilled {...ICON_SIZE} />
            ) : (
              <MessagesOutlined {...ICON_SIZE} />
            ),
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen
        name="Activity"
        component={WebViewStack}
        initialParams={{ initialPath: '/notifications' }}
        options={{
          tabBarIcon: ({ focused }) =>
            focused ? (
              <ActivityFilled {...ICON_SIZE} />
            ) : (
              <ActivityOutlined {...ICON_SIZE} />
            ),
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={WebviewSingletonStack}
        initialParams={{ initialPath: '/profile' }}
        options={{
          tabBarShowLabel: false,
        }}
      />
    </Tab.Navigator>
  </WebviewProvider>
);
