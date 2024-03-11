import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Circle, Icon, UrbitSigil, View } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';

import { useShip } from '../contexts/ship';
import { type Unread, type UnreadType, useQuery } from '../db';
import type { TabParamList } from '../types';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const { ship } = useShip();
  const shipIsPlanetOrLarger = ship && ship.length <= 14;

  const groupUnreads = useQuery<Unread[]>('Unread', (collection) => {
    console.log(JSON.stringify(collection, null, 2));
    return collection.filtered(
      'type == $0 AND totalCount > 0',
      'channel' as UnreadType
    );
  });

  const dmUnreads = useQuery<Unread[]>('Unread', (collection) => {
    return collection.filtered(
      'type == $0 AND totalCount > 0',
      'channel' as UnreadType
    );
  });

  return (
    <Tab.Navigator
      id="TabBar"
      initialRouteName="Groups"
      screenOptions={{
        headerShown: false,
      }}
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
              hasUnreads={groupUnreads.length > 0}
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
              hasUnreads={dmUnreads.length > 0}
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
  hasUnreads = false,
}: {
  type: IconType;
  activeType?: IconType;
  isActive: boolean;
  hasUnreads?: boolean;
}) {
  const resolvedType = isActive && activeType ? activeType : type;
  return (
    <View
      // borderWidth={1}
      // borderColor="$orange"
      flex={1}
    >
      <View flex={1} />
      <Icon
        type={resolvedType}
        color={isActive ? '$primaryText' : '$activeBorder'}
      />
      <View
        flex={1}
        // borderWidth={1}
        // borderColor="$green"
        justifyContent="center"
        alignItems="center"
      >
        <Circle
          size={6} // TODO: why isn't config value working?
          backgroundColor={hasUnreads ? '$color.blue' : undefined}
        />
      </View>
    </View>
  );
}
