import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useEffect, useRef } from 'react';

import SettingsScreen from '../features/settings/SettingsScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { NavBar, NavIcon } from '../ui/components/NavBar';
import {
  TopLevelTabName,
  getTopLevelTabRoute,
  trackTopLevelTabSelection,
} from './topLevelTabs';
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

  const hasBotDmTab = state.routes.some((route) => route.name === 'BotChat');

  return (
    <NavBar>
      {hasBotDmTab && (
        <NavIcon
          type="SmushStar"
          isActive={activeRouteName === 'BotChat'}
          hasUnreads={false}
          onPress={() => pressTab('BotChat')}
        />
      )}
      <NavIcon
        type="Channel"
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
  const botDm = useBotDmTab();
  const navigation = useNavigation();
  const focusedBotTab = useRef(false);

  // `initialRouteName` is read once, and on a cold start the bot DM has not
  // synced yet — so the tab is absent, ChatList wins, and focus stays there
  // once the tab appears. Claim it the first time it becomes available.
  useEffect(() => {
    if (!botDm.enabled || focusedBotTab.current) {
      return;
    }
    focusedBotTab.current = true;
    const route = getTopLevelTabRoute('BotChat');
    (navigation.navigate as (...args: unknown[]) => void)(
      route.name,
      route.params
    );
  }, [botDm.enabled, navigation]);

  return (
    <Tabs.Navigator
      initialRouteName={botDm.enabled ? 'BotChat' : 'ChatList'}
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ReactTopLevelTabBar {...props} />}
    >
      {botDm.enabled ? (
        <Tabs.Screen
          name="BotChat"
          component={ChannelScreen}
          initialParams={{ channelId: botDm.channelId }}
        />
      ) : null}
      <Tabs.Screen name="ChatList" component={ChatListScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}
