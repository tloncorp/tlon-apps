import { NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import type { RootStackParamList } from '../navigation/types';
import { GroupSettingsStackParamList } from '../navigation/types';
import { useRootNavigation, useTypedReset } from '../navigation/utils';
import { useIsWindowNarrow } from '../ui';

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

  return useCallback(() => {
    if (fromBlankChannel) {
      navigation.goBack();
    } else if (fromChatDetails) {
      navigation.getParent()?.navigate('ChatDetails', {
        chatType: 'group',
        chatId: groupId,
      });
    } else {
      navigation.goBack();
    }
  }, [navigation, fromChatDetails, fromBlankChannel, groupId]);
};

export const useChatSettingsNavigation = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigationRef = useMutableRef(navigation);

  const { navigateToChatDetails } = useRootNavigation();

  const {
    navigateToGroup,
    navigateToChatVolume: rootNavigateToChatVolume,
    resetToGroup,
    resetToChannel,
  } = useRootNavigation();
  const reset = useTypedReset();
  const isWindowNarrow = useIsWindowNarrow();

  const navigateToGroupSettings = useCallback(
    async <T extends keyof GroupSettingsStackParamList>(
      screen: T,
      params: GroupSettingsStackParamList[T]
    ) => {
      if (!isWindowNarrow && 'groupId' in params && params.groupId) {
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
          params: {
            state: {
              routes: [{ name: screen, params }],
              index: 0,
            },
          },
        });
        return;
      }

      navigation.navigate('GroupSettings', {
        state: {
          routes: [{ name: screen, params }],
          index: 0,
        },
      } as NavigatorScreenParams<GroupSettingsStackParamList>);
    },
    [navigation, isWindowNarrow]
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

  const onLeaveGroup = useCallback(() => {
    if (isWindowNarrow) {
      navigationRef.current.navigate('ChatList', undefined, { pop: true });
    } else {
      // Desktop: Reset navigation stack to clean Home state
      reset([{ name: 'Home' }]);
    }
  }, [navigationRef, isWindowNarrow, reset]);

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
    onPressChatVolume,
    onPressRoles,
    onPressCreateRole,
    onLeaveGroup,
    onLeaveChannel,
  };
};
