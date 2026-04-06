import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';

import { GroupSettingsStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';
import { useGroupContext } from './useGroupContext';

interface UseChannelEditScreenParams {
  groupId: string;
  channelId: string;
  fromChannelInfo?: boolean;
}

/**
 * Shared hook for channel edit screens (meta, privacy, etc.)
 * Provides common data fetching, navigation, and update logic.
 */
export function useChannelEditScreen(params: UseChannelEditScreenParams) {
  const { groupId, channelId, fromChannelInfo } = params;

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

  const isWindowNarrow = useIsWindowNarrow();
  const { navigateToChatDetails } = useRootNavigation();

  const handleGoBack = useCallback(() => {
    // When coming from ChannelInfo in GroupSettingsStack, simple goBack
    // pops back to ChannelInfo correctly
    if (fromChannelInfo) {
      navigation.goBack();
      return;
    }
    // On mobile (narrow), simply go back - the navigation stack is straightforward
    // On desktop (wide), navigate to ChatDetails because the GroupSettings stack
    // is mounted separately and goBack() would return to the channel view,
    // not the ChatDetails screen the user came from
    if (isWindowNarrow) {
      navigation.goBack();
    } else if (channel?.id) {
      navigateToChatDetails({ type: 'channel', id: channel.id, groupId });
    } else {
      navigation.goBack();
    }
  }, [
    fromChannelInfo,
    navigation,
    isWindowNarrow,
    navigateToChatDetails,
    channel?.id,
    groupId,
  ]);

  return {
    channel,
    group,
    isLoading: channelLoading || groupLoading,
    updateChannel,
    handleGoBack,
    navigation,
  };
}
