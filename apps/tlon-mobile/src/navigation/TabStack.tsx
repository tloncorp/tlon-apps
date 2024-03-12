import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Avatar, Circle, Icon, View } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';

import { useShip } from '../contexts/ship';
import {
  type Contact,
  type Unread,
  type UnreadType,
  useQuery,
  useRealm,
} from '../db';
import type { TabParamList } from '../types';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const { ship } = useShip();

  const groupUnreads = useQuery<Unread[]>('Unread', (collection) => {
    return collection.filtered(
      'type == $0 AND totalCount > 0',
      'channel' as UnreadType
    );
  });

  const dmUnreads = useQuery<Unread[]>('Unread', (collection) => {
    return collection.filtered(
      'type == $0 AND totalCount > 0',
      'dm' as UnreadType
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
          tabBarIcon: ({ focused }) => (
            <AvatarTabIcon id={ship!} focused={focused} />
          ),
          tabBarShowLabel: false,
        }}
      />
    </Tab.Navigator>
  );
};

function AvatarTabIcon({ id, focused }: { id: string; focused: boolean }) {
  const realm = useRealm();
  const contact = realm.objects<Contact>('Contact').filtered('id == $0', id)[0];
  const avatarImage = (contact && contact.avatarImage) ?? '';

  return (
    <Avatar id={id} avatarImage={avatarImage} opacity={focused ? 1 : 0.6} />
  );
}

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
    <View flex={1}>
      <View flex={1} />
      <Icon
        type={resolvedType}
        color={isActive ? '$primaryText' : '$activeBorder'}
      />
      <View flex={1} justifyContent="center" alignItems="center">
        <Circle size="$s" backgroundColor={hasUnreads ? '$blue' : undefined} />
      </View>
    </View>
  );
}
