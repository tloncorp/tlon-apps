import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import * as store from '@tloncorp/shared/store';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useEffect, useRef } from 'react';

import SettingsScreen from '../features/settings/SettingsScreen';
import { ActivityScreen } from '../features/top/ActivityScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { useAgentOnboardingLandingConsumer } from '../features/top/useAgentOnboardingLandingConsumer';
import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { NavBar, NavIcon } from '../ui/components/NavBar';
import { useContact } from '../ui/contexts/appDataContext';
import {
  TopLevelTabName,
  getTopLevelTabRoute,
  isAtColdStartPosition,
  isTabPressBlockedByOnboardingLock,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createBottomTabNavigator<TopLevelTabParamList>();

function ReactTopLevelTabBar({ state, navigation }: BottomTabBarProps) {
  const isWindowNarrow = useIsWindowNarrow();
  // Hooks stay above the early return below. The bot DM badges its own tab;
  // Activity badges what is happening everywhere else.
  const botDm = useBotDmTab();
  const botDmHasUnread = store.useChannelHasUnread(
    botDm.enabled ? botDm.channelId : undefined
  );
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
  const onboardingLock = useAnyAgentGroupOnboardingLock();
  // A DM's channel id is the other party's id, so this is the bot's contact.
  const botContact = useContact(botDm.enabled ? botDm.channelId : '');

  if (!isWindowNarrow) {
    return null;
  }

  const activeRouteName = state.routes[state.index]?.name;

  const pressTab = (name: TopLevelTabName) => {
    if (isTabPressBlockedByOnboardingLock(onboardingLock.locked, name)) {
      return;
    }
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
          imageUrl={botContact?.avatarImage ?? undefined}
          sigilContactId={botContact?.id}
          isActive={activeRouteName === 'BotChat'}
          hasUnreads={botDmHasUnread}
          onPress={() => pressTab('BotChat')}
        />
      )}
      <NavIcon
        type="Channel"
        isActive={activeRouteName === 'ChatList'}
        onPress={() => pressTab('ChatList')}
      />
      <NavIcon
        type="Notifications"
        isActive={activeRouteName === 'Activity'}
        hasUnreads={unseenActivityCount > 0}
        onPress={() => pressTab('Activity')}
        testID="ActivityNavIcon"
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
  // Above the lazy tabs, as on native: BotChat is the initial tab, so the
  // Workspaces screen — the consumer's old home — never mounts on a fresh account.
  useAgentOnboardingLandingConsumer();
  const navigation = useNavigation();
  const focusedBotTab = useRef(false);

  // `initialRouteName` is read once, and on a cold start the bot DM has not
  // synced yet — so the tab is absent, ChatList wins, and focus stays there
  // once the tab appears. Claim it the first time it becomes available.
  useEffect(() => {
    if (!botDm.enabled || focusedBotTab.current) {
      return;
    }
    // Claim only while the user is still where the cold start left them —
    // MainTabs with the initial ChatList tab showing and nothing asked of it.
    // If the DM syncs after they have opened Settings or another root screen,
    // or a deep link sent them to Workspaces with an invite to preview, leave
    // them there.
    if (!isAtColdStartPosition(navigation.getState())) {
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
      <Tabs.Screen name="Activity" component={ActivityScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}
