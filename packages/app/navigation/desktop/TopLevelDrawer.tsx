import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import * as store from '@tloncorp/shared/store';
import { AvatarNavIcon, NavIcon, YStack, useWebAppUpdate } from '@tloncorp/ui';
import { getVariableValue, useTheme } from 'tamagui';

import { ActivityScreen } from '../../features/top/ActivityScreen';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootDrawerParamList } from '../types';
import { HomeNavigator } from './HomeNavigator';
import { ProfileScreenNavigator } from './ProfileScreenNavigator';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const DrawerContent = (props: DrawerContentComponentProps) => {
  const userId = useCurrentUserId();
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const { webAppNeedsUpdate, triggerWebAppUpdate } = useWebAppUpdate();
  const isRouteActive = (routeName: string) => {
    return (
      props.state.index ===
      props.state.routes.findIndex((r) => r.name === routeName)
    );
  };

  return (
    <YStack gap="$l">
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive('Home')}
        // hasUnreads={(unreadCount?.channels ?? 0) > 0}
        // intentionally leave undotted for now
        hasUnreads={false}
        onPress={() =>
          props.navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
        }
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={haveUnreadUnseenActivity}
        isActive={isRouteActive('Activity')}
        onPress={() =>
          props.navigation.reset({ index: 0, routes: [{ name: 'Activity' }] })
        }
      />
      <AvatarNavIcon
        id={userId}
        focused={isRouteActive('Contacts')}
        onPress={() =>
          props.navigation.reset({ index: 0, routes: [{ name: 'Contacts' }] })
        }
      />
      {webAppNeedsUpdate && (
        <NavIcon
          backgroundColor="$yellow"
          type="Bang"
          isActive={true}
          onPress={triggerWebAppUpdate}
          shouldShowUnreads={false}
        />
      )}
    </YStack>
  );
};

export const TopLevelDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props: DrawerContentComponentProps) => {
        return <DrawerContent {...props} />;
      }}
      initialRouteName="Home"
      screenOptions={{
        drawerType: 'permanent',
        headerShown: false,
        drawerStyle: {
          width: 48,
          backgroundColor: getVariableValue(useTheme().background),
          borderRightColor: getVariableValue(useTheme().border),
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeNavigator} />
      <Drawer.Screen name="Activity" component={ActivityScreen} />
      <Drawer.Screen name="Contacts" component={ProfileScreenNavigator} />
    </Drawer.Navigator>
  );
};
