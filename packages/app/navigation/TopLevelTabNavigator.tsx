import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useIsWindowNarrow } from '@tloncorp/ui';

import SettingsScreen from '../features/settings/SettingsScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { useHomeGroupTab } from '../hooks/useHomeGroupTab';
import { NavBar, NavIcon } from '../ui/components/NavBar';
import { TopLevelTabName, trackTopLevelTabSelection } from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createBottomTabNavigator<TopLevelTabParamList>();

function ReactTopLevelTabBar({ state, navigation }: BottomTabBarProps) {
  const isWindowNarrow = useIsWindowNarrow();

  if (!isWindowNarrow) {
    return null;
  }

  const activeRouteName = state.routes[state.index]?.name;

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

  const hasHomeGroupTab = state.routes.some(
    (route) => route.name === 'HomeGroup'
  );

  return (
    <NavBar>
      {hasHomeGroupTab && (
        <NavIcon
          type="Home"
          activeType="HomeFilled"
          isActive={activeRouteName === 'HomeGroup'}
          hasUnreads={false}
          onPress={() => pressTab('HomeGroup')}
        />
      )}
      <NavIcon
        type="Messages"
        activeType="MessagesFilled"
        isActive={activeRouteName === 'ChatList'}
        hasUnreads={false}
        onPress={() => pressTab('ChatList')}
      />
      <NavIcon
        type="Settings"
        isActive={activeRouteName === 'Settings'}
        hasUnreads={false}
        onPress={() => pressTab('Settings')}
      />
    </NavBar>
  );
}

export function TopLevelTabNavigator() {
  const homeGroup = useHomeGroupTab();

  return (
    <Tabs.Navigator
      initialRouteName={homeGroup.enabled ? 'HomeGroup' : 'ChatList'}
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ReactTopLevelTabBar {...props} />}
    >
      {homeGroup.enabled ? (
        <Tabs.Screen
          name="HomeGroup"
          component={ChannelScreen}
          initialParams={{
            channelId: homeGroup.channelId,
            groupId: homeGroup.groupId,
          }}
        />
      ) : null}
      <Tabs.Screen name="ChatList" component={ChatListScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}
