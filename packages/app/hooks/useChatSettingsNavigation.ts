import { NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import { useCallback } from 'react';

import type { RootStackParamList } from '../navigation/types';
import { GroupSettingsStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';
import { useIsWindowNarrow } from '../ui';

export const useHandleGoBack = (
  navigation: NativeStackNavigationProp<
    GroupSettingsStackParamList,
    keyof GroupSettingsStackParamList
  >,
  params: { groupId: string; fromChatDetails?: boolean }
) => {
  const { groupId, fromChatDetails } = params;

  return useCallback(() => {
    if (fromChatDetails) {
      navigation.getParent()?.navigate('ChatDetails', {
        chatType: 'group',
        chatId: groupId,
      });
    } else {
      navigation.goBack();
    }
  }, [navigation, fromChatDetails, groupId]);
};

export const useChatSettingsNavigation = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigationRef = useMutableRef(navigation);

  const { navigateToChatDetails } = useRootNavigation();

  const { navigateToGroup, navigateToChatVolume } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const navigateToGroupSettings = useCallback(
    async <T extends keyof GroupSettingsStackParamList>(
      screen: T,
      params: GroupSettingsStackParamList[T]
    ) => {
      const paramsWithOrigin = {
        ...params,
        fromChatDetails: params.fromChatDetails ?? true,
      } as GroupSettingsStackParamList[T];

      if (!isWindowNarrow) {
        await navigateToGroup(params.groupId);
      }

      // Set a timeout to ensure the group is loaded before navigating
      // when navigating through a Drawer
      setTimeout(
        () => {
          navigation.navigate('GroupSettings', {
            screen,
            params: paramsWithOrigin,
          } as NavigatorScreenParams<GroupSettingsStackParamList>);
        },
        !isWindowNarrow ? 100 : 0
      );
    },
    [navigation, navigateToGroup, isWindowNarrow]
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

  const onLeaveGroup = useCallback(() => {
    navigationRef.current.navigate('ChatList');
  }, [navigationRef]);

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressChannelTemplate,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressGroupPrivacy,
    onPressChatDetails: navigateToChatDetails,
    onPressChatVolume: navigateToChatVolume,
    onPressRoles,
    onLeaveGroup,
  };
};
