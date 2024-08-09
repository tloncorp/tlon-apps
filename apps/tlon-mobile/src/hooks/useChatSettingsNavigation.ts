import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

import { GroupSettingsStackParamList } from '../types';

export const useChatSettingsNavigation = () => {
  const navigation = useNavigation();

  const navigateToGroupSettings = useCallback(
    <T extends keyof GroupSettingsStackParamList>(
      screen: T,
      params: GroupSettingsStackParamList[T]
    ) => {
      navigation.navigate('GroupSettings', {
        screen,
        params,
      } as any);
    },
    [navigation]
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

  const onPressInvitesAndPrivacy = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('InvitesAndPrivacy', { groupId });
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

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressInvitesAndPrivacy,
    onPressRoles,
  };
};
