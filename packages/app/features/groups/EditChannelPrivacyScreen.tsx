import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { EditChannelPrivacyScreenView } from '../../ui/components/ManageChannels/EditChannelPrivacyScreenView';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannelPrivacy'
>;

export function EditChannelPrivacyScreen(props: Props) {
  const { groupId, channelId } = props.route.params;

  const { channel, group, isLoading, updateChannel, handleGoBack } =
    useChannelEditScreen({ groupId, channelId });

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
