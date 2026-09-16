import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getTokenValue, useTheme } from 'tamagui';

import SettingsScreen from '../features/settings/SettingsScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import * as store from '@tloncorp/shared/store';

import { useAgentOnboardingLandingConsumer } from '../features/top/useAgentOnboardingLandingConsumer';
import { useBotDmTab } from '../hooks/useBotDmTab';
import {
  TOP_LEVEL_TABS,
  getTopLevelTabRoute,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createNativeBottomTabNavigator<TopLevelTabParamList>();

type TabIconName = 'bot' | 'workspaces' | 'settings';

const tabIcons = {
  bot: {
    regular: require('./assets/tab-bot.png'),
    selected: require('./assets/tab-bot.png'),
  },
  workspaces: {
    regular: require('./assets/tab-workspaces.png'),
    selected: require('./assets/tab-workspaces.png'),
  },
  settings: {
    regular: require('./assets/tab-settings.png'),
    selected: require('./assets/tab-settings.png'),
  },
} as const;

function tabIcon(name: TabIconName, focused: boolean) {
  return {
    type: 'image' as const,
    source: focused ? tabIcons[name].selected : tabIcons[name].regular,
  };
}

export function TopLevelTabNavigator() {
  const theme = useTheme();
  const botDm = useBotDmTab();
  // Tab screens mount lazily and BotChat is the initial tab, so a consumer
  // living in the Workspaces screen would never run on a fresh account; it
  // sits here, above every tab, and can reset the root stack from here.
  useAgentOnboardingLandingConsumer();
  const botDmHasUnread = store.useChannelHasUnread(
    botDm.enabled ? botDm.channelId : undefined
  );
  // Activity elsewhere: the bot DM already badges its own tab.
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
  // A native badge is text; a single space is UIKit's empty pill, which reads
  // as a dot. Undefined removes it.
  const dot = (lit: boolean) => (lit ? ' ' : undefined);
  // `blue` is a colour token, not a theme key: `useTheme().blue` is undefined
  // and the badge would fall back to the navigator's red. Read the token.
  const tabBarBadgeStyle = { backgroundColor: getTokenValue('$blue', 'color') };
  const navigation = useNavigation();
  const changedTabs = useRef(false);
  const focusedBotTab = useRef(false);

  // `initialRouteName` is read once, and on a cold start the bot DM has not
  // synced yet — so the tab is absent, ChatList wins, and focus stays there
  // once the tab appears. Claim it the first time it becomes available, unless
  // the user has already chosen a tab themselves.
  useEffect(() => {
    if (!botDm.enabled || focusedBotTab.current || changedTabs.current) {
      return;
    }
    // A tab press is not the only way to leave the cold-start position. If the
    // DM syncs after the user has opened Activity, Contacts, a workspace or
    // any other screen, claiming the tab now would yank them back to it. Only
    // claim while MainTabs is still the focused root route with the initial
    // ChatList tab showing; otherwise the moment has passed for good.
    const rootState = navigation.getState();
    const rootRoute = rootState?.routes[rootState.index];
    const tabsState = rootRoute?.state as
      | { index?: number; routes?: { name: string }[] }
      | undefined;
    const focusedTab = tabsState?.routes?.[tabsState.index ?? 0]?.name;
    if (
      rootRoute?.name !== 'MainTabs' ||
      (focusedTab && focusedTab !== 'ChatList')
    ) {
      focusedBotTab.current = true;
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
      screenListeners={({ navigation, route }) => ({
        tabPress: () => {
          // A deliberate tab choice outranks the bot-tab claim above.
          changedTabs.current = true;
          // Match the web nav bar: track selections, not re-presses of the
          // active tab.
          if (!navigation.isFocused()) {
            trackTopLevelTabSelection(route.name);
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryText?.val,
        tabBarInactiveTintColor: theme.secondaryText?.val,
        tabBarActiveIndicatorColor: theme.secondaryBackground?.val,
        tabBarLabelVisibilityMode: 'unlabeled',
        tabBarLabel: Platform.OS === 'ios' ? '' : undefined,
        tabBarControllerMode: Platform.OS === 'ios' ? 'tabBar' : undefined,
        tabBarMinimizeBehavior:
          Platform.OS === 'ios' ? 'onScrollDown' : undefined,
      }}
    >
      {botDm.enabled ? (
        <Tabs.Screen
          name="BotChat"
          component={ChannelScreen}
          initialParams={{ channelId: botDm.channelId }}
          options={{
            title: TOP_LEVEL_TABS.BotChat.title,
            tabBarIcon: ({ focused }) => tabIcon('bot', focused),
            tabBarBadge: dot(botDmHasUnread),
            tabBarBadgeStyle,
          }}
        />
      ) : null}
      <Tabs.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: TOP_LEVEL_TABS.ChatList.title,
          tabBarIcon: ({ focused }) => tabIcon('workspaces', focused),
          tabBarBadge: dot(unseenActivityCount > 0),
          tabBarBadgeStyle,
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: TOP_LEVEL_TABS.Settings.title,
          tabBarIcon: ({ focused }) => tabIcon('settings', focused),
        }}
      />
    </Tabs.Navigator>
  );
}
