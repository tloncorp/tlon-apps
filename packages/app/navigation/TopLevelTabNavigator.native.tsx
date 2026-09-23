import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { LoadingSpinner } from '@tloncorp/ui';
import { View, getTokenValue, useTheme } from 'tamagui';

import SettingsScreen from '../features/settings/SettingsScreen';
import { ActivityScreen } from '../features/top/ActivityScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import * as store from '@tloncorp/shared/store';

import { useAgentOnboardingLandingConsumer } from '../features/top/useAgentOnboardingLandingConsumer';
import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { useCalm, useContact } from '../ui/contexts/appDataContext';
import { useSigilColors } from '../ui/utils/colorUtils';
import {
  didRestoreNavigation,
  getRestoredTopLevelTab,
} from './navigationRestore';
import {
  TOP_LEVEL_TABS,
  getTopLevelTabRoute,
  isAtColdStartPosition,
  isAwaitingRestoredBotTab,
  isTabPressBlockedByOnboardingLock,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import type { TopLevelTabParamList } from './types';
import { BotTabIconSpec, useBotTabIcon } from './useBotTabIcon';

const Tabs = createNativeBottomTabNavigator<TopLevelTabParamList>();

type TabIconName = 'bot' | 'workspaces' | 'activity' | 'settings';

const tabIcons = {
  bot: {
    regular: require('./assets/tab-bot.png'),
    selected: require('./assets/tab-bot.png'),
  },
  workspaces: {
    regular: require('./assets/tab-workspaces.png'),
    selected: require('./assets/tab-workspaces.png'),
  },
  activity: {
    regular: require('./assets/tab-activity.png'),
    selected: require('./assets/tab-activity.png'),
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
  // A DM's channel id is the other party's id, so this is the bot's contact.
  const botContact = useContact(botDm.enabled ? botDm.channelId : '');
  const calm = useCalm();
  const botSigilColors = useSigilColors(botContact?.color);
  // The bot's avatar; its sigil when it has none, or when calm mode hides
  // avatars; the glyph until its contact has synced.
  // Skia can't decode SVG, and ImageAvatar skips it too, so an SVG avatar
  // falls back to the sigil here as it does in Settings and on web.
  const botAvatarUrl =
    calm.disableAvatars || botContact?.avatarImage?.endsWith('.svg')
      ? null
      : botContact?.avatarImage;
  const botTabIconSpec = useMemo<BotTabIconSpec | null>(
    () =>
      !botContact
        ? null
        : botAvatarUrl
          ? { kind: 'image', url: botAvatarUrl }
          : {
              kind: 'sigil',
              id: botContact.id,
              backgroundColor: botSigilColors.backgroundColor,
              foregroundColor: botSigilColors.foregroundColor,
            },
    [
      botContact,
      botAvatarUrl,
      botSigilColors.backgroundColor,
      botSigilColors.foregroundColor,
    ]
  );
  const botAvatarIcon = useBotTabIcon(botTabIconSpec);
  const botDmHasUnread = store.useChannelHasUnread(
    botDm.enabled ? botDm.channelId : undefined
  );
  // What the Activity tab badges: the bot DM already badges its own tab, so
  // one message never lights both.
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
    // A restored position is a choice the user already made, but a restored
    // ChatList looks exactly like a default one to `isAtColdStartPosition`, so
    // the shape cannot tell them apart and the claim would override it. The
    // bot tab is the exception: it is not registered while the hosted-bot flag
    // loads, so a position that named it is dropped and lands on ChatList —
    // there the claim completes the restore rather than overriding it.
    const completingRestore =
      getRestoredTopLevelTab() === 'BotChat' &&
      isAwaitingRestoredBotTab(navigation.getState());
    if (didRestoreNavigation() && !completingRestore) {
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
    if (!completingRestore && !isAtColdStartPosition(navigation.getState())) {
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

  // Rehydration drops a saved route whose screen is not registered, so a
  // restored position that named the bot tab loses it while the hosted-bot
  // flag is still loading — wherever in the stack that position sits, since a
  // screen pushed from the bot tab lives on the root stack above these tabs.
  // Holding the tabs unmounted until the flag resolves costs the restore
  // nothing: `MainTabs`' saved child state stays untouched on the parent route
  // until this navigator mounts to claim it. Only on a restore, so an ordinary
  // launch still mounts straight away and the claim above stays its correction.
  if (didRestoreNavigation() && botDm.isLoading) {
    return (
      <View flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </View>
    );
  }

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
            tabBarIcon: ({ focused }) =>
              botAvatarIcon
                ? {
                    type: 'image',
                    source: focused
                      ? botAvatarIcon.selected
                      : botAvatarIcon.regular,
                    tinted: false,
                  }
                : tabIcon('bot', focused),
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
          tabBarSelectionEnabled: !isTabPressBlockedByOnboardingLock(
            onboardingLock.locked,
            'ChatList'
          ),
        }}
      />
      <Tabs.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          title: TOP_LEVEL_TABS.Activity.title,
          tabBarIcon: ({ focused }) => tabIcon('activity', focused),
          tabBarBadge: dot(unseenActivityCount > 0),
          tabBarBadgeStyle,
          tabBarSelectionEnabled: !isTabPressBlockedByOnboardingLock(
            onboardingLock.locked,
            'Activity'
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
