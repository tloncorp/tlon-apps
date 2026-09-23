import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isBotDmChannel } from '@tloncorp/api/client/utils';
import { useLayoutEffect } from 'react';

import { useBotDmTab } from '../hooks/useBotDmTab';
import { getTopLevelTabRoute } from './topLevelTabs';
import type { RootStackParamList } from './types';

type StartupRoute = { name: keyof RootStackParamList; params?: object };

/**
 * The stack to wake up in. A hosted first run landed in the bot DM, which is
 * the Bot tab rather than a pushed screen, so the tabs alone hold it — with
 * the group riding along, as at the first handoff. Should the tab not be
 * registered after all, the same DM opens as a pushed conversation instead. A
 * setup chat sits over the tabs with a normal stack beneath it.
 */
export function buildOnboardingStartupRoutes(
  params: RootStackParamList['OnboardingStartup'],
  { botTabEnabled }: { botTabEnabled: boolean }
): StartupRoute[] {
  const pushed = { ...params, disableTransition: true };
  if (isBotDmChannel({ channel: { id: params.channelId } })) {
    return botTabEnabled
      ? [
          getTopLevelTabRoute('BotChat', {
            channelId: params.channelId,
            groupId: params.groupId,
          }),
        ]
      : [{ name: 'MainTabs' }, { name: 'DM', params: pushed }];
  }
  return [{ name: 'MainTabs' }, { name: 'Channel', params: pushed }];
}

/**
 * Cold-start entry for a still-locked onboarding conversation: rebuilds the
 * stack so the user wakes up where onboarding continues.
 */
export function OnboardingStartupScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'OnboardingStartup'>) {
  const botDm = useBotDmTab();
  useLayoutEffect(() => {
    // The Bot tab is registered only once the hosted-bot flag has loaded, and
    // MainTabs mounts with the tabs it knows at that moment. Resetting before
    // then would name a screen the navigator does not have, and the later
    // cold-start claim would refuse to correct it. Hold for the flag.
    if (botDm.isLoading) return;
    const routes = buildOnboardingStartupRoutes(route.params, {
      botTabEnabled: botDm.enabled,
    });
    navigation.reset({ index: routes.length - 1, routes });
  }, [botDm.enabled, botDm.isLoading, navigation, route.params]);

  return null;
}
