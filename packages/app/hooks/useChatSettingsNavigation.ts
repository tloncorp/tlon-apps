import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import type { RootStackParamList } from '../navigation/types';
import { GroupSettingsStackParamList } from '../navigation/types';

export const useChatSettingsNavigation = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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

  const navigateOnLeave = useCallback(
    () => {
      navigation.navigate('ChatList');
    },
    [navigation]
  );

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressGroupPrivacy,
    onPressRoles,
    navigateOnLeave,
  };
};
