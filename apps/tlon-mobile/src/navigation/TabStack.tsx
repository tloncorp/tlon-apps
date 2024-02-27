import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, UrbitSigil } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';

import { useShip } from '../contexts/ship';
import { WebviewProvider } from '../contexts/webview';
import type { TabParamList } from '../types';
import { WebviewSingletonStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const { ship } = useShip();
  return (
    <WebviewProvider>
      <Tab.Navigator
        id="TabBar"
        initialRouteName="Groups"
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen
          name="Groups"
          component={WebviewSingletonStack}
          initialParams={{ initialPath: '/' }}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                type={'Home'}
                activeType={'HomeFilled'}
                isActive={focused}
              />
            ),
            tabBarShowLabel: false,
          }}
        />
        <Tab.Screen
          name="Messages"
          component={WebviewSingletonStack}
          initialParams={{ initialPath: '/messages' }}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                type={'Messages'}
                activeType={'MessagesFilled'}
                isActive={focused}
              />
            ),
            tabBarShowLabel: false,
          }}
        />
        <Tab.Screen
          name="Activity"
          component={WebviewSingletonStack}
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
          component={WebviewSingletonStack}
          initialParams={{ initialPath: '/find' }}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon type="Discover" isActive={focused} />
            ),
            tabBarShowLabel: false,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={WebviewSingletonStack}
          initialParams={{ initialPath: '/profile' }}
          options={{
            tabBarIcon: () => (ship ? <UrbitSigil ship={ship} /> : undefined),
            tabBarShowLabel: false,
          }}
        />
      </Tab.Navigator>
    </WebviewProvider>
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
