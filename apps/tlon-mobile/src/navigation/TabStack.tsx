import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, UrbitSigil } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';

import { useShip } from '../contexts/ship';
import { useUnreads } from '../lib/api';
import type { TabParamList } from '../types';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  useUnreads();
  const { ship } = useShip();
  const shipIsPlanetOrLarger = ship && ship.length <= 14;

  return (
    <Tab.Navigator
      id="TabBar"
      initialRouteName="Groups"
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Groups"
        component={WebViewStack}
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
        component={WebViewStack}
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
        component={WebViewStack}
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
        name="Profile"
        component={WebViewStack}
        options={{
          tabBarIcon: ({ focused }) =>
            ship && shipIsPlanetOrLarger ? (
              <UrbitSigil ship={ship} />
            ) : (
              <TabIcon
                type={'Profile'}
                activeType={'Profile'}
                isActive={focused}
              />
            ),

          tabBarShowLabel: false,
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
