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
import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { didRestoreNavigation } from './navigationRestore';
import {
  TOP_LEVEL_TABS,
  getTopLevelTabRoute,
  isAtColdStartPosition,
  isTabPressBlockedByOnboardingLock,
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
  // Read through a ref: `screenListeners` closes over render-time values, and
  // the lock can lift without this navigator rendering again.
  const onboardingLock = useAnyAgentGroupOnboardingLock();
  const onboardingLockedRef = useRef(onboardingLock.locked);
  onboardingLockedRef.current = onboardingLock.locked;
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
    // A restored position is a choice the user already made, but a restored
    // ChatList looks exactly like a default one to `isAtColdStartPosition`, so
    // the shape cannot tell them apart and the claim would override it.
    if (
      !botDm.enabled ||
      focusedBotTab.current ||
      changedTabs.current ||
      didRestoreNavigation()
    ) {
      return;
    }
    // A tab press is not the only way to leave the cold-start position. If the
    // DM syncs after the user has opened Activity, Contacts, a workspace or
    // any other screen, claiming the tab now would yank them back to it — and
    // a deep link or notification that reset to Workspaces with a destination
    // (an invite preview) sent them somewhere, which is not where the cold
    // start left them. Only claim while MainTabs is still the focused root
    // route with the initial ChatList tab showing and nothing asked of it;
    // otherwise the moment has passed for good.
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
      screenListeners={({ navigation, route }) => ({
        tabPress: () => {
          // Selection is disabled below while locked; the press still fires,
          // and is neither a tab change to record nor a deliberate choice.
          if (
            isTabPressBlockedByOnboardingLock(
              onboardingLockedRef.current,
              route.name
            )
          ) {
            return;
          }
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
      {/* The other tabs would carry the user out of the locked onboarding
          conversation. UIKit switches before JS could refuse the press, so
          their selection is disabled for as long as the lock holds. */}
      <Tabs.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: TOP_LEVEL_TABS.ChatList.title,
          tabBarIcon: ({ focused }) => tabIcon('workspaces', focused),
          tabBarBadge: dot(unseenActivityCount > 0),
          tabBarBadgeStyle,
          tabBarSelectionEnabled: !isTabPressBlockedByOnboardingLock(
            onboardingLock.locked,
            'ChatList'
          ),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: TOP_LEVEL_TABS.Settings.title,
          tabBarIcon: ({ focused }) => tabIcon('settings', focused),
          tabBarSelectionEnabled: !isTabPressBlockedByOnboardingLock(
            onboardingLock.locked,
            'Settings'
          ),
        }}
      />
    </Tabs.Navigator>
  );
}
