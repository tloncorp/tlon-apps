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
  const { groupId, channelId, fromChatDetails, createdRoleId } =
    props.route.params;
  const { navigation } = props;

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

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      fromChatDetails,
      returnScreen: 'EditChannelPrivacy',
      returnParams: {
        groupId,
        channelId,
        fromChatDetails,
      },
    });
  }, [navigation, groupId, channelId, fromChatDetails]);

  return (
    <EditChannelPrivacyScreenView
      goBack={handleGoBack}
      isLoading={isLoading}
      channel={channel}
      group={group}
      onSubmit={handleSubmit}
      onCreateRole={handleCreateRole}
      createdRoleId={createdRoleId}
    />
  );
}
