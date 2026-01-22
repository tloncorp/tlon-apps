import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { EditChannelPrivacyScreenView } from '../../ui/components/ManageChannels/EditChannelPrivacyScreenView';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannelPrivacy'
>;

export function EditChannelPrivacyScreen(props: Props) {
  const { groupId, channelId } = props.route.params;
  const { navigation } = props;
  const { updateChannel } = useGroupContext({
    groupId,
  });
  const { data: channel, isLoading } = store.useChannel({
    id: channelId ?? '',
  });
  const { data: group } = store.useGroup({
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

  const handleSubmit = useCallback(
    async (readers: string[], writers: string[]) => {
      if (channel) {
        // Keep existing title and description unchanged
        updateChannel(
          {
            ...channel,
          },
          readers,
          writers
        );
        handleGoBack();
      }
    },
    [channel, updateChannel, handleGoBack]
  );

  return (
    <EditChannelPrivacyScreenView
      goBack={handleGoBack}
      isLoading={isLoading}
      channel={channel}
      group={group}
      onSubmit={handleSubmit}
    />
  );
}
