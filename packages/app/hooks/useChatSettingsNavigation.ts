import {
  NavigationProp,
  NavigatorScreenParams,
  ParamListBase,
  useNavigation,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { getPickedChannelNavigation } from '../navigation/drawerDestination';
import {
  type RouteSnapshot,
  getLeftChatTopLevelTab,
  getTopLevelTabRoute,
} from '../navigation/topLevelTabs';
import type { RootStackParamList } from '../navigation/types';
import { GroupSettingsStackParamList } from '../navigation/types';
import {
  useIsMobileTree,
  useRootNavigation,
  useTypedReset,
} from '../navigation/utils';
import { useIsWindowNarrow } from '../ui';
import { useBotDmTab } from './useBotDmTab';

export const useHandleGoBack = (
  navigation: NativeStackNavigationProp<
    GroupSettingsStackParamList,
    keyof GroupSettingsStackParamList
  >,
  params: {
    groupId: string;
    fromChatDetails?: boolean;
    fromBlankChannel?: boolean;
  }
) => {
  const { groupId, fromChatDetails, fromBlankChannel } = params;
  const isWindowNarrow = useIsWindowNarrow();

  return useCallback(() => {
    if (fromBlankChannel) {
      navigation.goBack();
    } else if (fromChatDetails) {
      // On narrow (mobile) under React Navigation v7, the old
      // navigate('ChatDetails', ...) call pushed a duplicate ChatDetails
      // route instead of popping to the existing one, which caused the
      // TLON-5647 back-navigation loop. Popping the GroupSettings stack
      // with goBack() returns to the sibling ChatDetails directly.
      // Wide (desktop) keeps the pre-existing cross-navigator navigate,
      // which already worked correctly for the same flow.
      if (isWindowNarrow) {
        navigation.goBack();
      } else {
        navigation.getParent()?.navigate('ChatDetails', {
          chatType: 'group',
          chatId: groupId,
        });
      }
    } else {
      navigation.goBack();
    }
  }, [navigation, fromChatDetails, fromBlankChannel, groupId, isWindowNarrow]);
};

type GroupSettingsRoute = {
  [Screen in keyof GroupSettingsStackParamList]: {
    name: Screen;
    params: GroupSettingsStackParamList[Screen];
  };
}[keyof GroupSettingsStackParamList];

/**
 * The state of the stack the sections sit at the bottom of, read from any
 * screen of it or of a navigator nested beneath it.
 */
function getSectionStackState(
  navigation: NavigationProp<ParamListBase> | undefined
): RouteSnapshot['state'] {
  for (let current = navigation; current; current = current.getParent()) {
    const state = current.getState();
    if (state?.routeNames.includes('MainTabs')) {
      return state as unknown as RouteSnapshot['state'];
    }
  }
  return undefined;
}

export const useChatSettingsNavigation = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigationRef = useMutableRef(navigation);

  const { navigateToChatDetails } = useRootNavigation();

  const {
    navigateToGroup,
    navigateToChannel,
    navigateToChatVolume: rootNavigateToChatVolume,
    resetToGroup,
    resetToChannel,
  } = useRootNavigation();
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();
  const isMobileTree = useIsMobileTree();
  const botDm = useBotDmTab();
  const botChannelId = botDm.enabled ? botDm.channelId : null;

  /** Open the group settings stack on `routes`, the last of them focused. */
  const navigateToGroupSettingsRoutes = useCallback(
    async (routes: GroupSettingsRoute[]) => {
      const { params } = routes[routes.length - 1];
      const state = { routes, index: routes.length - 1 };
      // The desktop tree nests GroupSettings under Channel. A wide native
      // window is still the mobile tree, where it is a screen of the root.
      if (!isMobileTree && 'groupId' in params && params.groupId) {
        // Navigate directly to Channel > GroupSettings in a single call.
        // The old 2-step approach (navigateToGroup + setTimeout) breaks in
        // React Navigation v7 because 'Home' is ambiguous (matches
        // MainStack > Home instead of TopLevelDrawer > Home) and the
        // setTimeout uses a stale navigation ref after screen unmount.
        const group = await db.getGroup({ id: params.groupId });
        const channelId =
          group?.channels?.[0]?.id ?? params.groupId.replace('group/', 'chat/');
        navigation.navigate('Channel' as any, {
          channelId,
          groupId: params.groupId,
          screen: 'GroupSettings',
          pop: true,
          params: { state },
        });
        return;
      }

      navigation.navigate('GroupSettings', {
        state,
      } as NavigatorScreenParams<GroupSettingsStackParamList>);
    },
    [navigation, isMobileTree]
  );

  const navigateToGroupSettings = useCallback(
    <T extends keyof GroupSettingsStackParamList>(
      screen: T,
      params: GroupSettingsStackParamList[T]
    ) =>
      navigateToGroupSettingsRoutes([
        { name: screen, params } as GroupSettingsRoute,
      ]),
    [navigateToGroupSettingsRoutes]
  );

  const onPressGroupMeta = useCallback(
    (
      groupId: string,
      fromBlankChannel?: boolean,
      fromChatDetails?: boolean
    ) => {
      navigateToGroupSettings('GroupMeta', {
        groupId,
        fromBlankChannel,
        fromChatDetails,
      });
    },
    [navigateToGroupSettings]
  );

  const onPressGroupMembers = useCallback(
    (groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('GroupMembers', { groupId, fromChatDetails });
    },
    [navigateToGroupSettings]
  );

  const onPressManageChannels = useCallback(
    (groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('ManageChannels', { groupId, fromChatDetails });
    },
    [navigateToGroupSettings]
  );

  const onPressGroupPrivacy = useCallback(
    (groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('Privacy', { groupId, fromChatDetails });
    },
    [navigateToGroupSettings]
  );

  const onPressRoles = useCallback(
    (groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('GroupRoles', { groupId, fromChatDetails });
    },
    [navigateToGroupSettings]
  );

  const onPressCreateRole = useCallback(
    (
      groupId: string,
      returnScreen?: keyof GroupSettingsStackParamList,
      returnParams?: Record<string, unknown>
    ) => {
      navigateToGroupSettings('AddRole', {
        groupId,
        returnScreen,
        returnParams,
      });
    },
    [navigateToGroupSettings]
  );

  const onPressCreateChannelPermissions = useCallback(
    (params: GroupSettingsStackParamList['CreateChannelPermissions']) => {
      // Over Manage channels, which the permissions screen returns to once the
      // channel is made: the stack then ends where it does when the channel is
      // started from Manage channels, rather than stacking Manage channels
      // over a finished permissions screen.
      navigateToGroupSettingsRoutes([
        { name: 'ManageChannels', params: { groupId: params.groupId } },
        { name: 'CreateChannelPermissions', params },
      ]);
    },
    [navigateToGroupSettingsRoutes]
  );

  const onPressChannel = useCallback(
    (channel: db.Channel) => {
      if (!isMobileTree) {
        navigateToChannel(channel);
        return;
      }
      const { mode, params } = getPickedChannelNavigation(
        getSectionStackState(navigationRef.current),
        channel
      );
      if (mode === 'replace') {
        navigationRef.current.navigate('Channel', params, { pop: true });
      } else {
        navigationRef.current.push('Channel', params);
      }
    },
    [isMobileTree, navigateToChannel, navigationRef]
  );

  const onPressChatVolume = useCallback(
    (params: { type: 'group' | 'channel'; id: string; groupId?: string }) => {
      rootNavigateToChatVolume(params);
    },
    [rootNavigateToChatVolume]
  );

  const onPressChannelMembers = useCallback(
    (channelId: string) => {
      navigationRef.current.navigate('ChannelMembers', { channelId });
    },
    [navigationRef]
  );

  const onPressChannelMeta = useCallback(
    (channelId: string) => {
      navigationRef.current.navigate('ChannelMeta', { channelId });
    },
    [navigationRef]
  );

  const onPressChannelTemplate = useCallback(
    (channelId: string) => {
      navigationRef.current.navigate('ChannelTemplate', { channelId });
    },
    [navigationRef]
  );

  const onPressEditChannelMeta = useCallback(
    (channelId: string, groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('EditChannelMeta', {
        channelId,
        groupId,
        fromChatDetails,
      });
    },
    [navigateToGroupSettings]
  );

  const onPressEditChannelPrivacy = useCallback(
    (channelId: string, groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('EditChannelPrivacy', {
        channelId,
        groupId,
        fromChatDetails,
      });
    },
    [navigateToGroupSettings]
  );

  const onLeaveGroup = useCallback(
    (leftChannelId?: string) => {
      if (Platform.OS !== 'web' || isWindowNarrow) {
        const route = getTopLevelTabRoute(
          getLeftChatTopLevelTab(botChannelId, leftChannelId)
        );
        navigationRef.current.navigate(route.name, route.params, {
          pop: true,
        });
      } else {
        // Desktop: Reset navigation stack to clean Home state
        reset([{ name: 'Home' }]);
      }
    },
    [navigationRef, isWindowNarrow, reset, botChannelId]
  );

  const onLeaveChannel = useCallback(
    async (groupId: string, leavingChannelId: string) => {
      const group = await db.getGroup({ id: groupId });

      if (!group?.channels || group.channels.length === 0) {
        // No channels left - go to group view
        resetToGroup(groupId);
        return;
      }

      // Find first channel that isn't the one being left
      const nextChannel = group.channels.find(
        (ch) => ch.id !== leavingChannelId
      );

      if (nextChannel) {
        // Navigate to the first available channel
        resetToChannel(nextChannel.id, {
          groupId,
        });
      } else {
        // All channels filtered out - go to group view
        resetToGroup(groupId);
      }
    },
    [resetToGroup, resetToChannel]
  );

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressChannelTemplate,
    onPressEditChannelMeta,
    onPressEditChannelPrivacy,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressGroupPrivacy,
    onPressChatDetails: navigateToChatDetails,
    onPressChannel,
    onPressCreateChannelPermissions,
    onPressChatVolume,
    onPressRoles,
    onPressCreateRole,
    onLeaveGroup,
    onLeaveChannel,
  };
};
