import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, Text, UrbitSigil, useStyle } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import type { ViewStyle } from 'react-native';

import { useShip } from '../contexts/ship';
import type { TabParamList } from '../types';
import { HomeStack } from './HomeStack';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const headerStyle = useStyle({
    paddingHorizontal: '$xl',
  }) as ViewStyle;
  const { ship } = useShip();
  return (
    <Tab.Navigator
      id="TabBar"
      initialRouteName="Groups"
      screenOptions={{
        headerShown: false,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        headerTitle({ style, ...props }) {
          return (
            <Text fontSize="$m" fontWeight="$s" lineHeight="$s" {...props} />
          );
        },
        headerLeftContainerStyle: headerStyle,
        headerRightContainerStyle: headerStyle,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Groups"
        component={HomeStack}
        initialParams={{ initialPath: '/' }}
        options={{
          headerShown: true,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              type={'Home'}
              activeType={'HomeFilled'}
              isActive={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={WebViewStack}
        initialParams={{ initialPath: '/messages' }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              type={'Messages'}
              activeType={'MessagesFilled'}
              isActive={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={WebViewStack}
        initialParams={{ initialPath: '/notifications' }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              type={'Notifications'}
              activeType={'NotificationsFilled'}
              isActive={focused}
            />
          ),
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen
        name="Discover"
        component={WebViewStack}
        initialParams={{ initialPath: '/find' }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon type="Discover" isActive={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={WebViewStack}
        initialParams={{ initialPath: '/profile' }}
        options={{
          tabBarIcon: () => (ship ? <UrbitSigil ship={ship} /> : undefined),
        }}
      />
    </Tab.Navigator>
  );
};

function TabIcon({
  type,
  activeType,
  isActive,
}: {
  type: IconType;
  activeType?: IconType;
  isActive: boolean;
}) {
  const resolvedType = isActive && activeType ? activeType : type;
  return (
    <Icon
      type={resolvedType}
      color={isActive ? '$primaryText' : '$activeBorder'}
    />
  );
}
