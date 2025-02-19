import {
  CommonActions,
  NavigationProp,
  useNavigation as useReactNavigation,
} from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useGlobalSearch, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useFeatureFlagStore } from '../lib/featureFlags';
import { CombinedParamList, RootStackParamList } from './types';

export const useNavigation = () => {
  return useReactNavigation<NavigationProp<CombinedParamList>>();
};

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
  const navigation = useNavigation();
  return createTypedReset(navigation);
}

function useResetToChannel() {
  const navigation = useNavigation();
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();

  return function resetToChannel(
    channelId: string,
    options?: {
      groupId?: string;
      selectedPostId?: string | null;
      startDraft?: boolean;
    }
  ) {
    const screenName = screenNameFromChannelId(channelId);

    if (isWindowNarrow) {
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
    } else {
      const tab = getTab(navigation);
      const channelRoute = getDesktopChannelRoute(
        tab,
        channelId,
        options?.groupId,
        options?.selectedPostId ?? undefined
      );
      reset([channelRoute]);
    }
  };
}

function useResetToDm() {
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

function useResetToGroup() {
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();

  return async function resetToGroup(groupId: string) {
    if (isWindowNarrow) {
      reset([{ name: 'ChatList' }, await getMainGroupRoute(groupId, true)]);
    } else {
      reset([
        {
          name: 'Home',
          params: {
            screen: 'GroupChannels',
            params: {
              groupId,
            },
          },
        },
      ]);
    }
  };
}

function useNavigateToChannel() {
  const isWindowNarrow = useIsWindowNarrow();
  const navigation = useNavigation();
  const { lastOpenTab } = useGlobalSearch();

  return useCallback(
    (channel: db.Channel, selectedPostId?: string) => {
      if (isWindowNarrow) {
        const screenName = screenNameFromChannelId(channel.id);
        navigation.navigate(screenName, {
          channelId: channel.id,
          selectedPostId,
          ...(channel.groupId ? { groupId: channel.groupId } : {}),
        });
      } else {
        const tab = (lastOpenTab as 'Home' | 'Messages') ?? getTab(navigation);
        const channelRoute = getDesktopChannelRoute(
          tab,
          channel.id,
          channel.groupId ?? undefined,
          selectedPostId
        );
        navigation.navigate(channelRoute);
      }
    },
    [isWindowNarrow, navigation, lastOpenTab]
  );
}

export function useNavigateToPost() {
  const isWindowNarrow = useIsWindowNarrow();
  const navigation = useNavigation();
  const activityIndex = navigation
    .getState()
    ?.routes.findIndex((route) => route.name === 'Activity');
  const currentScreenIsActivity =
    navigation.getState()?.index === activityIndex;

  return useCallback(
    (post: db.Post) => {
      if (!isWindowNarrow && currentScreenIsActivity) {
        navigation.navigate(getTab(navigation), {
          screen: 'Channel',
          params: {
            screen: 'Post',
            params: {
              postId: post.id,
              authorId: post.authorId,
              channelId: post.channelId,
              groupId: post.groupId ?? undefined,
            },
          },
        });
        return;
      }

      navigation.navigate('Post', {
        postId: post.id,
        authorId: post.authorId,
        channelId: post.channelId,
        groupId: post.groupId ?? undefined,
      });
    },
    [navigation, isWindowNarrow, currentScreenIsActivity]
  );
}

export function useNavigateBackFromPost() {
  const isWindowNarrow = useIsWindowNarrow();
  const navigation = useNavigation();
  const length = navigation.getState()?.routes.length;
  const lastScreenWasActivity =
    navigation.getState()?.routes[length - 2]?.name === 'Activity';

  return useCallback(
    (channel: db.Channel, postId: string) => {
      if (lastScreenWasActivity) {
        navigation.navigate('Activity');
        return;
      }
      const isChatShaped = ['chat', 'dm', 'groupDM'].includes(channel.type);
      if (isWindowNarrow) {
        const screenName = screenNameFromChannelId(channel.id);
        navigation.navigate(screenName, {
          channelId: channel.id,
          // we don't want to highlight the selected post we're returning from
          // if we aren't in a chat
          selectedPostId: isChatShaped ? postId : undefined,
          ...(channel.groupId ? { groupId: channel.groupId } : {}),
        });
      } else {
        // @ts-expect-error - ChannelRoot is fine here.
        navigation.navigate('ChannelRoot', {
          channelId: channel.id,
          selectedPostId: isChatShaped ? postId : undefined,
          groupId: channel.groupId ?? undefined,
        });
      }
    },
    [navigation, isWindowNarrow, lastScreenWasActivity]
  );
}

function getTab(
  navigation:
    | NavigationProp<RootStackParamList>
    | NavigationProp<CombinedParamList>
): 'Home' | 'Messages' {
  const parent = navigation.getParent()?.getState();
  const state = parent?.type === 'Drawer' ? parent : navigation.getState();
  if (state.type !== 'drawer') {
    console.log(parent, navigation.getState());
    throw new Error('Top-level navigator is not a drawer navigator');
  }

  const last = state.routes[state.index];
  return last.name === 'Messages' ? 'Messages' : 'Home';
}

export function useRootNavigation() {
  const isWindowNarrow = useIsWindowNarrow();
  const navigation = useNavigation();
  const navigationRef = logic.useMutableRef(navigation);
  const navigateToGroup = useCallback(
    async (groupId: string) => {
      navigationRef.current.navigate(
        await getMainGroupRoute(groupId, isWindowNarrow)
      );
    },
    [navigationRef, isWindowNarrow]
  );

  const useNavigateToChatDetails = () => {
    const isWindowNarrow = useIsWindowNarrow();

    return useCallback(
      (chat: { type: 'group' | 'channel'; id: string }) => {
        if (isWindowNarrow) {
          navigationRef.current.navigate('ChatDetails', {
            chatId: chat.id,
            chatType: chat.type,
          });
        } else {
          const tab = getTab(navigationRef.current);
          navigationRef.current.navigate(tab, {
            screen: 'ChatDetails',
            params: {
              chatId: chat.id,
              chatType: chat.type,
            },
          });
        }
      },
      [isWindowNarrow]
    );
  };

  const useNavigateToChatVolume = () => {
    const isWindowNarrow = useIsWindowNarrow();

    return useCallback(
      (chat: { type: 'group' | 'channel'; id: string }) => {
        if (isWindowNarrow) {
          navigationRef.current.navigate('ChatVolume', {
            chatId: chat.id,
            chatType: chat.type,
          });
        } else {
          const tab = getTab(navigationRef.current);
          navigationRef.current.navigate(tab, {
            screen: 'ChatVolume',
            params: {
              chatId: chat.id,
              chatType: chat.type,
            },
          });
        }
      },
      [isWindowNarrow]
    );
  };

  const navigateBack = useCallback(() => {
    navigationRef.current.goBack();
  }, [navigationRef]);

  const resetToChannel = useResetToChannel();
  const navigateToChannel = useNavigateToChannel();
  const navigateToChatDetails = useNavigateToChatDetails();
  const navigateToChatVolume = useNavigateToChatVolume();
  const navigateBackFromPost = useNavigateBackFromPost();
  const navigateToPost = useNavigateToPost();
  const resetToGroup = useResetToGroup();
  const resetToDm = useResetToDm();

  return useMemo(
    () => ({
      navigation,
      navigateToGroup,
      navigateToChannel,
      navigateBackFromPost,
      navigateToPost,
      navigateToChatDetails,
      navigateToChatVolume,
      resetToGroup,
      resetToChannel,
      resetToDm,
      navigateBack,
    }),
    [
      navigation,
      navigateToChannel,
      navigateToChatDetails,
      navigateToChatVolume,
      navigateBackFromPost,
      navigateToGroup,
      navigateToPost,
      resetToGroup,
      resetToChannel,
      resetToDm,
      navigateBack,
    ]
  );
}

export function getDesktopChannelRoute(
  tab: 'Home' | 'Messages',
  channelId: string,
  groupId?: string,
  selectedPostId?: string
) {
  const screenName = screenNameFromChannelId(channelId);
  return {
    name: tab,
    params: {
      screen: screenName,
      initial: true,
      params: {
        channelId,
        selectedPostId,
        ...(groupId ? { groupId } : {}),
      },
    },
  } as const;
}

export async function getMainGroupRoute(
  groupId: string,
  isWindowNarrow: boolean
) {
  const group = await db.getGroup({ id: groupId });
  const channelSwitcherEnabled =
    useFeatureFlagStore.getState().flags.channelSwitcher;
  if (
    group &&
    group.channels &&
    (group.channels.length === 1 || channelSwitcherEnabled || !isWindowNarrow)
  ) {
    if (!isWindowNarrow && group.lastVisitedChannelId) {
      return getDesktopChannelRoute(
        'Home',
        group.lastVisitedChannelId,
        groupId
      );
    }

    if (!isWindowNarrow) {
      return getDesktopChannelRoute('Home', group.channels[0].id, groupId);
    }

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
    : logic.isGroupDmChannelId(channelId)
      ? 'GroupDM'
      : 'Channel';
}
