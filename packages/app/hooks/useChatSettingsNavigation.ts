import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';

import type { RootStackParamList } from '../navigation/types';
import { GroupSettingsStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';

export const useChatSettingsNavigation = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { navigateToGroup } = useRootNavigation();
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
      navigation.navigate('ChannelMembers', { channelId });
    },
    [navigation]
  );

  const onPressChannelMeta = useCallback(
    (channelId: string) => {
      navigation.navigate('ChannelMeta', { channelId });
    },
    [navigation]
  );

  const onPressChannelTemplate = useCallback(
    (channelId: string) => {
      navigation.navigate('ChannelTemplate', { channelId });
    },
    [navigation]
  );

  const navigateOnLeave = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressChannelTemplate,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressGroupPrivacy,
    onPressRoles,
    navigateOnLeave,
  };
};
