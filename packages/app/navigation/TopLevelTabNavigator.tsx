import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useState } from 'react';

import { ActivityScreen } from '../features/top/ActivityScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import ContactsScreen from '../features/top/ContactsScreen';
import { useShowWebSplashModal } from '../hooks/useShowWebSplashModal';
import { useTopLevelTabController } from '../hooks/useTopLevelTabController';
import { AvatarNavIcon, NavBar, NavIcon } from '../ui/components/NavBar';
import ProfileStatusSheet from '../ui/components/ProfileStatusSheet';
import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import { TopLevelTabName, trackTopLevelTabSelection } from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createBottomTabNavigator<TopLevelTabParamList>();

function WebTopLevelTabBar({ state, navigation }: BottomTabBarProps) {
  const isWindowNarrow = useIsWindowNarrow();
  const { currentUserId, haveUnreadActivity, statusSheet } =
    useTopLevelTabController();

  if (!isWindowNarrow) {
    return null;
  }

  const pressTab = (name: TopLevelTabName) => {
    const index = state.routes.findIndex((route) => route.name === name);
    const route = state.routes[index];
    if (!route) {
      return;
    }

    const isFocused = state.index === index;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused) {
      trackTopLevelTabSelection(name);
      if (!event.defaultPrevented) {
        navigation.navigate(name);
      }
    }
  };

  const longPressProfile = () => {
    const route = state.routes.find(
      (candidate) => candidate.name === 'Contacts'
    );
    if (route) {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    }
    statusSheet.openSheet();
  };

  return (
    <>
      <NavBar>
        <NavIcon
          type="Home"
          activeType="HomeFilled"
          isActive={state.routes[state.index]?.name === 'ChatList'}
          hasUnreads={false}
          onPress={() => pressTab('ChatList')}
        />
        <NavIcon
          type="Notifications"
          activeType="NotificationsFilled"
          hasUnreads={haveUnreadActivity}
          isActive={state.routes[state.index]?.name === 'Activity'}
          onPress={() => pressTab('Activity')}
        />
        <AvatarNavIcon
          id={currentUserId}
          focused={state.routes[state.index]?.name === 'Contacts'}
          onPress={() => pressTab('Contacts')}
          onLongPress={longPressProfile}
        />
      </NavBar>
      {statusSheet.open && (
        <ProfileStatusSheet
          open
          onOpenChange={statusSheet.closeSheet}
          onUpdateStatus={statusSheet.updateStatus}
        />
      )}
    </>
  );
}

export function TopLevelTabNavigator() {
  const showSplash = useShowWebSplashModal();
  const [splashDismissed, setSplashDismissed] = useState(false);
  return (
    <>
      <Tabs.Navigator
        initialRouteName="ChatList"
        backBehavior="history"
        screenOptions={{ headerShown: false }}
        tabBar={WebTopLevelTabBar}
      >
        <Tabs.Screen name="ChatList" component={ChatListScreen} />
        <Tabs.Screen name="Activity" component={ActivityScreen} />
        <Tabs.Screen name="Contacts" component={ContactsScreen} />
      </Tabs.Navigator>
      <SplashModal
        open={showSplash && !splashDismissed}
        setOpen={(open) => {
          if (!open) {
            setSplashDismissed(true);
          }
        }}
      />
    </>
  );
}
