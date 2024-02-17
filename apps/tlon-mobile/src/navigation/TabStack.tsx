import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { TabParamList } from '../types';
import { WebViewStack } from './WebViewStack';

const Stack = createBottomTabNavigator<TabParamList>();

export const TabStack = () => (
  <Stack.Navigator
    initialRouteName="Groups"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen
      name="Groups"
      component={WebViewStack}
      initialParams={{ initialPath: '/' }}
    />
    <Stack.Screen
      name="Messages"
      component={WebViewStack}
      initialParams={{ initialPath: '/messages' }}
      options={{ tabBarLabel: 'DMs' }}
    />
    <Stack.Screen
      name="Activity"
      component={WebViewStack}
      initialParams={{ initialPath: '/notifications' }}
    />
    <Stack.Screen
      name="Profile"
      component={WebViewStack}
      initialParams={{ initialPath: '/profile' }}
    />
  </Stack.Navigator>
);
