import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { GroupSettingsStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';
import { useGroupContext } from './useGroupContext';

interface UseChannelEditScreenParams {
  groupId: string;
  channelId: string;
}

/**
 * Shared hook for channel edit screens (meta, privacy, etc.)
 * Provides common data fetching, navigation, and update logic.
 */
export function useChannelEditScreen(params: UseChannelEditScreenParams) {
  const { groupId, channelId } = params;

  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        GroupSettingsStackParamList,
        'EditChannelMeta' | 'EditChannelPrivacy'
      >
    >();

  const { updateChannel } = useGroupContext({ groupId });

  const { data: channel, isLoading: channelLoading } = store.useChannel({
    id: channelId ?? '',
  });

  const { data: group, isLoading: groupLoading } = store.useGroup({
    id: groupId ?? '',
  });

  const { navigateToChatDetails } = useRootNavigation();

  const handleGoBack = useCallback(() => {
    if (channel?.id) {
      navigateToChatDetails({ type: 'channel', id: channel.id });
    } else {
      navigation.goBack();
    }
  }, [navigation, navigateToChatDetails, channel?.id]);

  return {
    channel,
    group,
    isLoading: channelLoading || groupLoading,
    updateChannel,
    handleGoBack,
    navigation,
  };
}
