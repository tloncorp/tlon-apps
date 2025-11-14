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
  } = useRootNavigation();
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

      if (!isWindowNarrow && 'groupId' in params) {
        await navigateToGroup(params.groupId);
      }

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

  const onPressChatVolume = useCallback(
    (params: {
      type: 'group' | 'channel';
      id: string;
      fromChatDetails?: boolean;
    }) => {
      const { type, id, fromChatDetails } = params;

      if (type === 'group') {
        navigateToGroupSettings('ChatVolume', {
          chatType: type,
          chatId: id,
          fromChatDetails,
        });
      } else {
        rootNavigateToChatVolume(params);
      }
    },
    [navigateToGroupSettings, rootNavigateToChatVolume]
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

  const onPressEditChannel = useCallback(
    (channelId: string, groupId: string, fromChatDetails?: boolean) => {
      navigateToGroupSettings('EditChannel', {
        channelId,
        groupId,
        fromChatDetails,
      });
    },
    [navigateToGroupSettings]
  );

  const onLeaveGroup = useCallback(() => {
    const routeName = isWindowNarrow ? 'ChatList' : 'Home';
    // @ts-expect-error - 'Home' is a valid route on desktop (RootDrawerParamList) but not in RootStackParamList
    navigationRef.current.navigate(routeName);
  }, [navigationRef, isWindowNarrow]);

  const onLeaveChannel = useCallback(
    (groupId: string) => {
      resetToGroup(groupId);
    },
    [resetToGroup]
  );

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressChannelTemplate,
    onPressEditChannel,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressGroupPrivacy,
    onPressChatDetails: navigateToChatDetails,
    onPressChatVolume,
    onPressRoles,
    onLeaveGroup,
    onLeaveChannel,
  };
};
