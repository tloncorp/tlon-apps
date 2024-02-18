import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  ActivityFilled,
  ActivityOutlined,
  HomeFilled,
  HomeOutlined,
  MessagesFilled,
  MessagesOutlined,
} from '../../assets/icons';
import type { TabParamList } from '../types';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

const ICON_SIZE = {
  width: 20,
  height: 20,
};

export const TabStack = () => (
  <Tab.Navigator
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
      component={WebViewStack}
      initialParams={{ initialPath: '/profile' }}
      options={{
        tabBarShowLabel: false,
      }}
    />
  </Tab.Navigator>
);
