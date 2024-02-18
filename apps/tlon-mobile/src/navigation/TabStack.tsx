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
        tabBarIcon: ({ focused, size }) =>
          focused ? (
            <HomeFilled width={size} height={size} />
          ) : (
            <HomeOutlined width={size} height={size} />
          ),
        tabBarLabel: '',
      }}
    />
    <Tab.Screen
      name="Messages"
      component={WebViewStack}
      initialParams={{ initialPath: '/messages' }}
      options={{
        tabBarIcon: ({ focused, size }) =>
          focused ? (
            <MessagesFilled width={size} height={size} />
          ) : (
            <MessagesOutlined width={size} height={size} />
          ),
        tabBarLabel: '',
      }}
    />
    <Tab.Screen
      name="Activity"
      component={WebViewStack}
      initialParams={{ initialPath: '/notifications' }}
      options={{
        tabBarIcon: ({ focused, size }) =>
          focused ? (
            <ActivityFilled width={size} height={size} />
          ) : (
            <ActivityOutlined width={size} height={size} />
          ),
        tabBarLabel: '',
      }}
    />
    <Tab.Screen
      name="Profile"
      component={WebViewStack}
      initialParams={{ initialPath: '/profile' }}
    />
  </Tab.Navigator>
);
