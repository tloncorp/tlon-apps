import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';

import type { RootStackParamList } from '../navigation/types';
import { GroupSettingsStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';

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
      if (!isWindowNarrow) {
        // We need to navigate to the group first to ensure that the group is loaded
        await navigateToGroup(params.groupId);
        setTimeout(() => {
          navigation.navigate('GroupSettings', {
            screen,
            params,
          } as any);
        }, 100);
      } else {
        navigation.navigate('GroupSettings', {
          screen,
          params,
        } as any);
      }
    },
    [navigation, navigateToGroup, isWindowNarrow]
  );

  const onPressGroupMeta = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupMeta', { groupId });
    },
    [navigateToGroupSettings]
  );

  const onPressGroupMembers = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupMembers', { groupId });
    },
    [navigateToGroupSettings]
  );

  const onPressManageChannels = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('ManageChannels', { groupId });
    },
    [navigateToGroupSettings]
  );

  const onPressGroupPrivacy = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('Privacy', { groupId });
    },
    [navigateToGroupSettings]
  );

  const onPressRoles = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupRoles', { groupId });
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
