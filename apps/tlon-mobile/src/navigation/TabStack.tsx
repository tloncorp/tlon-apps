import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Avatar,
  Circle,
  Icon,
  Text,
  UrbitSigil,
  View,
  ZStack,
  useStyle,
} from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import type { ViewStyle } from 'react-native';

import { useShip } from '../contexts/ship';
import { fallbackContact } from '../db';
import { useContact, useUnreadChannelsCount } from '../db/hooks';
import type { TabParamList } from '../types';
import { HomeStack } from './HomeStack';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const headerStyle = useStyle({
    paddingHorizontal: '$xl',
  }) as ViewStyle;
  const { ship } = useShip();
  const unreadCount = useUnreadChannelsCount();

  return (
    <Tab.Navigator
      id="TabBar"
      initialRouteName="Groups"
      screenOptions={{
        headerShown: false,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        headerTitle({ style, ...props }) {
          return (
            <Text
              fontSize="$m"
              fontWeight="$s"
              lineHeight="$s"
              color="$primaryText"
              {...props}
            />
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
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              type={'Messages'}
              activeType={'MessagesFilled'}
              isActive={focused}
              hasUnreads={unreadCount.dms > 0}
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
  const contact = useContact(id);
  return (
    <Avatar
      contact={contact ?? fallbackContact(id)}
      opacity={focused ? 1 : 0.6}
    />
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
