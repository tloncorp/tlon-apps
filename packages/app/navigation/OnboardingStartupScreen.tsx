import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isBotDmChannel } from '@tloncorp/api/client/utils';
import { useLayoutEffect } from 'react';

import { getTopLevelTabRoute } from './topLevelTabs';
import type { RootStackParamList } from './types';

type StartupRoute = { name: keyof RootStackParamList; params?: object };

/**
 * The stack to wake up in. A hosted first run landed in the bot DM, which is
 * the Bot tab rather than a pushed screen, so the tabs alone hold it — with
 * the group riding along, as at the first handoff. A setup chat sits over the
 * tabs with a normal stack beneath it.
 */
export function buildOnboardingStartupRoutes(
  params: RootStackParamList['OnboardingStartup']
): StartupRoute[] {
  if (isBotDmChannel({ channel: { id: params.channelId } })) {
    return [
      getTopLevelTabRoute('BotChat', {
        channelId: params.channelId,
        groupId: params.groupId,
      }),
    ];
  }
  return [
    { name: 'MainTabs' },
    { name: 'Channel', params: { ...params, disableTransition: true } },
  ];
}

/**
 * Cold-start entry for a still-locked onboarding conversation: immediately
 * rebuilds the stack so the user wakes up where onboarding continues.
 */
export function OnboardingStartupScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'OnboardingStartup'>) {
  useLayoutEffect(() => {
    const routes = buildOnboardingStartupRoutes(route.params);
    navigation.reset({ index: routes.length - 1, routes });
  }, [navigation, route.params]);

  return null;
}
