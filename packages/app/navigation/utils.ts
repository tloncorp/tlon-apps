import {
  CommonActions,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useFeatureFlagStore } from '../lib/featureFlags';
import { RootStackNavigationProp, RootStackParamList } from './types';

type ResetRouteConfig<T extends Record<string, any>> = {
  name: Extract<keyof T, string>;
  params?: T[Extract<keyof T, string>];
};

export function createTypedReset<T extends Record<string, any>>(
  navigation: NavigationProp<T>
) {
  return function reset(
    routes: ResetRouteConfig<T>[],
    index = routes.length - 1
  ) {
    navigation.dispatch(
      // eslint-disable-next-line no-restricted-syntax
      CommonActions.reset({
        index,
        routes,
      })
    );
  };
}

// This is a custom hook that returns a function that resets the navigation stack
// to the provided routes. It's useful for resetting the navigation stack to a
// specific route or set of routes.
export function useTypedReset() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return createTypedReset(navigation);
}

export function useResetToChannel() {
  const reset = useTypedReset();

  return function resetToChannel(
    channelId: string,
    options?: {
      groupId?: string;
      selectedPostId?: string | null;
      startDraft?: boolean;
    }
  ) {
    const screenName = screenNameFromChannelId(channelId);

    reset([
      { name: 'ChatList' },
      {
        name: screenName,
        params: {
          channelId,
          ...options,
        },
      },
    ]);
  };
}

export function useResetToDm() {
  const resetToChannel = useResetToChannel();

  return async function resetToDm(contactId: string) {
    try {
      const dmChannel = await store.upsertDmChannel({
        participants: [contactId],
      });
      resetToChannel(dmChannel.id);
    } catch (error) {
      console.error('Error creating DM channel:', error);
    }
  };
}

export function useResetToGroup() {
  const reset = useTypedReset();

  return async function resetToGroup(groupId: string) {
    reset([{ name: 'ChatList' }, await getMainGroupRoute(groupId)]);
  };
}

export function useNavigateToGroup() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const navigationRef = logic.useMutableRef(navigation);
  return useCallback(
    async (groupId: string) => {
      navigationRef.current.navigate(await getMainGroupRoute(groupId));
    },
    [navigationRef]
  );
}

export async function getMainGroupRoute(groupId: string) {
  const group = await db.getGroup({ id: groupId });
  const channelSwitcherEnabled =
    useFeatureFlagStore.getState().flags.channelSwitcher;
  if (
    group &&
    group.channels &&
    (group.channels.length === 1 || channelSwitcherEnabled)
  ) {
    return {
      name: 'Channel',
      params: { channelId: group.channels[0].id, groupId },
    } as const;
  } else {
    return {
      name: 'GroupChannels',
      params: { groupId },
    } as const;
  }
}

export function screenNameFromChannelId(channelId: string) {
  return logic.isDmChannelId(channelId)
    ? 'DM'
    : logic.isGroupChannelId(channelId)
      ? 'GroupDM'
      : 'Channel';
}
