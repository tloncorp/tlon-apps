import {
  CommonActions,
  NavigationProp,
  StackActions,
  useNavigation as useReactNavigation,
} from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useGlobalSearch, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

import { openExternalBotSettings } from '../utils/botSettings';

import type {
  DesktopBasePathStackParamList,
  MobileBasePathStackParamList,
} from './BasePathNavigator';
import {
  TOP_LEVEL_DRAWER_ROUTES,
  getActiveTopLevelDrawerRouteName,
  getDesktopChannelRoute,
  getDesktopGroupEntryRoute,
  getDesktopGroupInviteRoute,
  getDesktopPostRoute,
  isActivityBackTarget,
  screenNameFromChannelId,
} from './routeHelpers';
import { getTopLevelTabRoute } from './topLevelTabs';
import { CombinedParamList, RootStackParamList } from './types';

export { screenNameFromChannelId } from './routeHelpers';
export { getTopLevelTabRoute } from './topLevelTabs';

const logger = createDevLogger('nav-utils', false);

export const mediaViewerScreenOptions: NativeStackNavigationOptions = {
  animation: 'none',
  presentation: 'transparentModal',
  contentStyle: { backgroundColor: 'transparent' },
};

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
      // eslint-disable-next-line tlon/no-common-actions-reset
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
  const navigationRef = logic.useMutableRef(navigation);
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();
  const { lastOpenTab } = useGlobalSearch();

  return useCallback(
    function resetToChannel(
      channelId: string,
      options?: {
        backToGroupIndex?: boolean;
        disableTransition?: boolean;
        groupId?: string;
        selectedPostId?: string | null;
        startDraft?: boolean;
      }
    ) {
      const screenName = screenNameFromChannelId(channelId);

      if (isWindowNarrow) {
        const { backToGroupIndex, ...channelOptions } = options ?? {};
        reset([
          getTopLevelTabRoute('ChatList'),
          ...(backToGroupIndex && channelOptions.groupId
            ? [
                {
                  name: 'GroupChannels' as const,
                  params: { groupId: channelOptions.groupId },
                },
              ]
            : []),
          {
            name: screenName,
            params: {
              channelId,
              ...channelOptions,
            },
          },
        ]);
      } else {
        const tab = getTab(navigationRef.current, lastOpenTab);
        logger.log('resetToChannel', { tab, channelId, options });
        const channelRoute = getDesktopChannelRoute(
          tab,
          channelId,
          options?.groupId,
          options?.selectedPostId ?? undefined
        );
        reset([channelRoute]);
      }
    },
    [isWindowNarrow, lastOpenTab, navigationRef, reset]
  );
}

function useResetToPost() {
  const navigation = useNavigation();
  const navigationRef = logic.useMutableRef(navigation);
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();
  const { lastOpenTab } = useGlobalSearch();

  return useCallback(
    function resetToPost(postParams: RootStackParamList['Post']) {
      if (isWindowNarrow) {
        const screenName = screenNameFromChannelId(postParams.channelId);
        reset([
          getTopLevelTabRoute('ChatList'),
          {
            name: screenName,
            params: {
              channelId: postParams.channelId,
              groupId: postParams.groupId,
            },
          },
          { name: 'Post', params: postParams },
        ]);
      } else {
        const tab = getTab(navigationRef.current, lastOpenTab);
        reset([getDesktopPostRoute(tab, postParams)]);
      }
    },
    [isWindowNarrow, lastOpenTab, navigationRef, reset]
  );
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
      reset([
        getTopLevelTabRoute('ChatList'),
        await getMainGroupRoute(groupId, true),
      ]);
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

function useResetToGroupInvite() {
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();

  return async function resetToGroupInvite(groupId: string) {
    if (isWindowNarrow) {
      // matches the mobile push-notification tap: chat list with the invited
      // group's preview sheet open (see groupInvitePreviewRouteStack)
      reset([
        getTopLevelTabRoute('ChatList', {
          previewGroupId: groupId,
          previewGroupFromInviteNotification: true,
        }),
      ]);
    } else {
      reset([getDesktopGroupInviteRoute(groupId)]);
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
        navigation.navigate(
          screenName,
          {
            channelId: channel.id,
            selectedPostId,
            ...(channel.groupId ? { groupId: channel.groupId } : {}),
          },
          { pop: true }
        );
      } else {
        const tab = getTab(navigation, lastOpenTab);
        const channelRoute = getDesktopChannelRoute(
          tab,
          channel.id,
          channel.groupId ?? undefined,
          selectedPostId
        );
        logger.log('navigateToChannel', {
          channelRoute,
          tab,
          channelId: channel.id,
          groupId: channel.groupId,
          selectedPostId,
        });
        navigation.navigate(channelRoute);
      }
    },
    [isWindowNarrow, navigation, lastOpenTab]
  );
}

export function useNavigateToPost() {
  const isWindowNarrow = useIsWindowNarrow();
  const navigation = useNavigation();
  const { lastOpenTab } = useGlobalSearch();

  return useCallback(
    (post: db.Post, options?: { selectedPostId?: string | null }) => {
      const postParams = {
        postId: post.id,
        authorId: post.authorId,
        channelId: post.channelId,
        groupId: post.groupId ?? undefined,
        selectedPostId: options?.selectedPostId,
      };

      // Evaluate at press time (not hook-render time) against the live parent
      // navigator chain. The desktop Activity drawer is nested, so inspecting
      // only the locally-scoped state misses the top-level `Activity` route.
      const currentScreenIsActivity =
        getActiveTopLevelDrawerRouteName(navigation) === 'Activity';

      if (!isWindowNarrow && currentScreenIsActivity) {
        const tab = getTab(navigation, lastOpenTab);
        logger.log('navigateToPost', tab, postParams);

        navigation.navigate(getDesktopPostRoute(tab, postParams));
        return;
      }

      navigation.navigate('Post', postParams, { pop: true });
    },
    [isWindowNarrow, navigation, lastOpenTab]
  );
}

export function useNavigateBackFromPost() {
  const isWindowNarrow = useIsWindowNarrow();
  const navigation = useNavigation();

  return useCallback(
    (channel: db.Channel, postId: string) => {
      // Read route state at action time (not at hook-render time) and identify
      // the previous route via state.index, so the decision doesn't depend on
      // stack shape or stale captured values.
      const state = navigation.getState();
      const previousRoute =
        state && state.index > 0 ? state.routes[state.index - 1] : undefined;

      const previousRouteParams = previousRoute?.params as
        | { channelId?: string }
        | undefined;
      const lastScreenWasActivity = isActivityBackTarget(previousRoute);
      // @ts-expect-error - ChannelRoot is fine here.
      const lastScreenWasChannel = previousRoute?.name === 'ChannelRoot';
      const lastChannelWasChat =
        lastScreenWasChannel && previousRouteParams?.channelId
          ? previousRouteParams.channelId.startsWith('chat')
          : false;

      const isChatShaped = ['chat', 'dm', 'groupDm'].includes(channel.type);
      if (lastChannelWasChat && !isChatShaped) {
        // if we're returning from viewing a notebook/gallery post and the last
        // channel was a chat, we should navigate to the chat instead of the
        // notebook/gallery channel
        navigation.goBack();
        return;
      }
      if (lastScreenWasActivity) {
        const route = getTopLevelTabRoute('Activity');
        navigation.navigate(route.name, route.params, { pop: true });
        return;
      }
      if (isWindowNarrow) {
        const screenName = screenNameFromChannelId(channel.id);
        const params = {
          channelId: channel.id,
          // we don't want to highlight the selected post we're returning from
          // if we aren't in a chat
          selectedPostId: isChatShaped ? postId : undefined,
          ...(channel.groupId ? { groupId: channel.groupId } : {}),
        };
        // popTo pops back to the target channel if it's already in the stack
        // (the normal in-channel thread case), or replaces the focused Post in
        // place if it isn't (e.g. a thread opened from a reference in a DM) —
        // never pushing a duplicate channel that would leave Post underneath
        // and create a back-stack loop. Note: with no getId on the stack
        // screens, popTo matches by name only, so it won't preserve a stacked
        // same-name route for a *different* channel; we accept that rather than
        // add getId (which would change pop/dedupe matching app-wide).
        navigation.dispatch(StackActions.popTo(screenName, params));
      } else {
        navigation.navigate(
          // @ts-expect-error - ChannelRoot is fine here.
          'ChannelRoot',
          {
            channelId: channel.id,
            selectedPostId: isChatShaped ? postId : undefined,
            groupId: channel.groupId ?? undefined,
          },
          { pop: true }
        );
      }
    },
    [navigation, isWindowNarrow]
  );
}

function getTab(
  navigation:
    | NavigationProp<
        MobileBasePathStackParamList & DesktopBasePathStackParamList
      >
    | NavigationProp<RootStackParamList>
    | NavigationProp<CombinedParamList>,
  lastOpenTab: 'Home' | 'Messages'
): 'Home' | 'Messages' {
  const parent = navigation.getParent()?.getState();
  const state =
    parent?.type.toLocaleLowerCase() === 'drawer'
      ? parent
      : navigation.getState();

  logger.log('looking for drawer', parent, navigation.getState());
  if (state.type !== 'drawer' || state.routes[state.index]?.name === 'Root') {
    console.warn(
      'Top-level navigator is not a drawer navigator, using lastOpenTab'
    );
    return lastOpenTab;
  }

  const last = state.routes[state.index];
  logger.log('last route name', last.name);
  if (!(TOP_LEVEL_DRAWER_ROUTES as readonly string[]).includes(last.name)) {
    logger.log('not top level drawer, getting tab from parent');
    return getTab(navigation.getParent(), lastOpenTab);
  }

  if (last.name === 'Home' || last.name === 'Messages') {
    return last.name;
  }

  return lastOpenTab;
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
    const { lastOpenTab } = useGlobalSearch();

    return useCallback(
      (chat: { type: 'group' | 'channel'; id: string; groupId?: string }) => {
        if (isWindowNarrow) {
          navigationRef.current.navigate(
            'ChatDetails',
            {
              chatId: chat.id,
              chatType: chat.type,
              groupId: chat.groupId,
            },
            { pop: true }
          );
        } else {
          const tab = getTab(navigationRef.current, lastOpenTab);
          navigationRef.current.navigate(
            tab,
            {
              screen: 'ChatDetails',
              params: {
                chatId: chat.id,
                chatType: chat.type,
                groupId: chat.groupId,
              },
            },
            { pop: true }
          );
        }
      },
      [isWindowNarrow]
    );
  };

  const useNavigateToChatVolume = () => {
    const isWindowNarrow = useIsWindowNarrow();
    const { lastOpenTab } = useGlobalSearch();

    return useCallback(
      (chat: { type: 'group' | 'channel'; id: string; groupId?: string }) => {
        if (isWindowNarrow) {
          navigationRef.current.navigate(
            'ChatVolume',
            {
              chatId: chat.id,
              chatType: chat.type,
              groupId: chat.groupId,
            },
            { pop: true }
          );
        } else {
          const tab = getTab(navigationRef.current, lastOpenTab);
          navigationRef.current.navigate(
            tab,
            {
              screen: 'ChatVolume',
              params: {
                chatId: chat.id,
                chatType: chat.type,
                groupId: chat.groupId,
              },
            },
            { pop: true }
          );
        }
      },
      [isWindowNarrow]
    );
  };

  const navigateBack = useCallback(() => {
    navigationRef.current.goBack();
  }, [navigationRef]);

  const navigateToBotSettings = useCallback(() => {
    if (isWindowNarrow) {
      navigationRef.current.navigate('BotSettings');
      return;
    }

    const navigateToNestedSettings = navigationRef.current.navigate as (
      screen: 'Settings',
      params: { screen: 'BotSettings' }
    ) => void;
    navigateToNestedSettings('Settings', {
      screen: 'BotSettings',
    });
  }, [isWindowNarrow, navigationRef]);

  const navigateToBotMcpSettings = useCallback(
    (providerId?: string) => {
      if (Platform.OS === 'web') {
        openExternalBotSettings();
        return;
      }
      const params = providerId ? { providerId } : undefined;
      navigationRef.current.navigate('BotMcpSettings', params);
    },
    [navigationRef]
  );

  const resetToChannel = useResetToChannel();
  const navigateToChannel = useNavigateToChannel();
  const navigateToChatDetails = useNavigateToChatDetails();
  const navigateToChatVolume = useNavigateToChatVolume();
  const navigateBackFromPost = useNavigateBackFromPost();
  const navigateToPost = useNavigateToPost();
  const resetToGroup = useResetToGroup();
  const resetToGroupInvite = useResetToGroupInvite();
  const resetToDm = useResetToDm();
  const resetToPost = useResetToPost();

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
      resetToGroupInvite,
      resetToChannel,
      resetToDm,
      resetToPost,
      navigateBack,
      navigateToBotSettings,
      navigateToBotMcpSettings,
    }),
    [
      navigation,
      navigateBack,
      navigateToChannel,
      navigateToChatDetails,
      navigateToChatVolume,
      navigateToBotSettings,
      navigateToBotMcpSettings,
      navigateBackFromPost,
      navigateToGroup,
      navigateToPost,
      resetToGroup,
      resetToGroupInvite,
      resetToChannel,
      resetToDm,
      resetToPost,
    ]
  );
}

export async function getMainGroupRoute(
  groupId: string,
  isWindowNarrow: boolean
) {
  // This route decision already needs the full group. Populate the same query
  // cache used by GroupChannels so its first render does not repeat the DB read
  // during the native push animation.
  const [group, lastVisitedChannelId] = await Promise.all([
    store.fetchGroup(groupId),
    isWindowNarrow ? null : db.lastVisitedChannelId(groupId).getValue(),
  ]);

  if (!isWindowNarrow) {
    return getDesktopGroupEntryRoute(
      groupId,
      group?.channels?.map((channel) => channel.id) ?? [],
      lastVisitedChannelId
    );
  }

  if (
    group &&
    group.channels &&
    group.channels.length === 1
  ) {
    return {
      name: 'Channel',
      params: { channelId: group.channels[0].id, groupId },
      pop: true,
    } as const;
  } else {
    return {
      name: 'GroupChannels',
      params: { groupId },
      pop: true,
    } as const;
  }
}
