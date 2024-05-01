import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as store from '@tloncorp/shared/dist/store';
import type { IconType } from '@tloncorp/ui';
import { Circle, Icon, SizableText, View, useStyle } from '@tloncorp/ui';
import { Avatar } from '@tloncorp/ui';
import type { ViewStyle } from 'react-native';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import ProfileScreen from '../screens/ProfileScreen';
import type { TabParamList } from '../types';
import { HomeStack } from './HomeStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const currentUserId = useCurrentUserId();
  const { data: unreadCount } = store.useAllUnreadsCounts();
  const headerStyle = useStyle({
    paddingHorizontal: '$xl',
  }) as ViewStyle;

  const tabBarStyle = useStyle({
    backgroundColor: '$background',
    borderTopWidth: 1,
    borderTopColor: '$border',
    paddingTop: '$m',
  }) as ViewStyle;

  return (
    <Tab.Navigator
      id="TabBar"
      initialRouteName="Groups"
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabBarStyle,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        headerTitle({ style, ...props }) {
          return (
            <SizableText
              size="$s"
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
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              type={'Home'}
              activeType={'HomeFilled'}
              isActive={focused}
              hasUnreads={(unreadCount?.channels ?? 0) > 0}
            />
          ),
          tabBarShowLabel: false,
        }}
      />

      <Tab.Screen
        name="Activity"
        component={View}
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
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <AvatarTabIcon id={currentUserId!} focused={focused} />
          ),
          tabBarShowLabel: false,
        }}
      />
    </Tab.Navigator>
  );
};

function AvatarTabIcon({ id, focused }: { id: string; focused: boolean }) {
  const { data: contact, isLoading } = store.useContact({ id });
  return isLoading && !contact ? null : (
    // Uniquely sized avatar for tab bar
    <Avatar
      width={26}
      height={26}
      borderRadius={6}
      contact={contact}
      contactId={id}
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
