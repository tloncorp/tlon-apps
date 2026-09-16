import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useTheme } from 'tamagui';

import SettingsScreen from '../features/settings/SettingsScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import * as store from '@tloncorp/shared/store';

import { useBotDmTab } from '../hooks/useBotDmTab';
import {
  TOP_LEVEL_TABS,
  getTopLevelTabRoute,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createNativeBottomTabNavigator<TopLevelTabParamList>();

type TabIconName = 'bot' | 'workspaces' | 'settings';

// No filled variants, so one glyph serves both tab states. Unread is a second
// asset with a small dot beneath the glyph — see the icon sync script for why
// it is not a native badge.
const tabIcons = {
  bot: {
    regular: require('./assets/tab-bot.png'),
    unread: require('./assets/tab-bot-unread.png'),
  },
  workspaces: {
    regular: require('./assets/tab-workspaces.png'),
    unread: require('./assets/tab-workspaces-unread.png'),
  },
  settings: {
    regular: require('./assets/tab-settings.png'),
  },
} as const;

function tabIcon(name: TabIconName, unread = false) {
  const icons: { regular: number; unread?: number } = tabIcons[name];
  return {
    type: 'image' as const,
    source: (unread && icons.unread) || icons.regular,
  };
}

export function TopLevelTabNavigator() {
  const theme = useTheme();
  const botDm = useBotDmTab();
  const botDmUnreadCount = store.useChannelUnreadCount(
    botDm.enabled ? botDm.channelId : undefined
  );
  // Activity elsewhere: the bot DM already badges its own tab.
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
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
            tabBarIcon: () => tabIcon('bot', botDmUnreadCount > 0),
          }}
        />
      ) : null}
      <Tabs.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: TOP_LEVEL_TABS.ChatList.title,
          tabBarIcon: () => tabIcon('workspaces', unseenActivityCount > 0),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: TOP_LEVEL_TABS.Settings.title,
          tabBarIcon: () => tabIcon('settings'),
        }}
      />
    </Tabs.Navigator>
  );
}
