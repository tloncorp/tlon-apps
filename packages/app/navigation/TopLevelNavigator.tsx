import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { LoadingSpinner } from '@tloncorp/ui';
import { useCallback, useEffect, useRef } from 'react';
import { View } from 'tamagui';

import SettingsScreen from '../features/settings/SettingsScreen';
import { ActivityScreen } from '../features/top/ActivityScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { useAgentOnboardingLandingConsumer } from '../features/top/useAgentOnboardingLandingConsumer';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { useTopLevelSectionReselected } from './topLevelSectionReselect';
import {
  didRestoreNavigation,
  getRestoredTopLevelTab,
} from './navigationRestore';
import {
  getInitialTopLevelTab,
  getTopLevelTabRoute,
  isAtColdStartPosition,
  isAwaitingRestoredBotTab,
} from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createBottomTabNavigator<TopLevelTabParamList>();

/**
 * The sections are reached from the top-level drawer, which sits above the
 * whole root stack, so this navigator draws no bar of its own.
 *
 * It still mounts one, because the bar is where this navigator's `navigation`
 * is in reach: choosing the section already showing has to arrive as a
 * `tabPress` on it, which is the event `useScrollToTop` listens for to send a
 * list back to the top. The drawer cannot emit that from outside.
 */
function SectionTabBar({ state, navigation }: BottomTabBarProps) {
  useTopLevelSectionReselected(
    useCallback(
      (section) => {
        const focused = state.routes[state.index];
        if (focused?.name !== section) {
          return;
        }
        navigation.emit({
          type: 'tabPress',
          target: focused.key,
          canPreventDefault: true,
        });
      },
      [navigation, state]
    )
  );

  return null;
}

export function TopLevelNavigator() {
  const botDm = useBotDmTab();
  // Section screens mount lazily and BotChat is the initial one, so a consumer
  // living in the Workspaces screen would never run on a fresh account; it
  // sits here, above every section, and can reset the root stack from here.
  useAgentOnboardingLandingConsumer();
  const navigation = useNavigation();
  const focusedBotTab = useRef(false);

  // `initialRouteName` is read once, and on a cold start the bot DM has not
  // synced yet — so the section is absent, ChatList wins, and focus stays
  // there once it appears. Claim it the first time it becomes available.
  useEffect(() => {
    if (!botDm.enabled || focusedBotTab.current) {
      return;
    }
    // A restored position is a choice the user already made, but a restored
    // ChatList looks exactly like a default one to `isAtColdStartPosition`, so
    // the shape cannot tell them apart and the claim would override it. The
    // bot section is the exception: it is not registered while the hosted-bot
    // flag loads, so a position that named it is dropped and lands on ChatList
    // — there the claim completes the restore rather than overriding it.
    const completingRestore =
      getRestoredTopLevelTab() === 'BotChat' &&
      isAwaitingRestoredBotTab(navigation.getState());
    if (didRestoreNavigation() && !completingRestore) {
      return;
    }
    // Choosing a section is not the only way to leave the cold-start position.
    // If the DM syncs after the user has opened Activity, Contacts, a
    // workspace or any other screen, claiming the section now would yank them
    // back to it — and a deep link or notification that reset to Workspaces
    // with a destination (an invite preview) sent them somewhere, which is not
    // where the cold start left them. A drawer selection lands here too: it
    // names its section in `MainTabs`' params, which is not the cold-start
    // shape either. Only claim while MainTabs is still the focused root route
    // with the initial ChatList section showing and nothing asked of it;
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
  // restored position that named the bot section loses it while the
  // hosted-bot flag is still loading — wherever in the stack that position
  // sits, since a screen pushed from the bot section lives on the root stack
  // above this navigator. Holding it unmounted until the flag resolves costs
  // the restore nothing: `MainTabs`' saved child state stays untouched on the
  // parent route until this navigator mounts to claim it. Only on a restore,
  // so an ordinary launch still mounts straight away and the claim above stays
  // its correction.
  if (didRestoreNavigation() && botDm.isLoading) {
    return (
      <View flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <Tabs.Navigator
      initialRouteName={getInitialTopLevelTab(botDm.enabled)}
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <SectionTabBar {...props} />}
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
