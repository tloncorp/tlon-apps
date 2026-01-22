import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { EditChannelMetaScreenView } from '../../ui/components/ManageChannels/EditChannelMetaScreenView';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannelMeta'
>;

export function EditChannelMetaScreen(props: Props) {
  const { groupId, channelId } = props.route.params;
  const { navigation } = props;
  const { updateChannel } = useGroupContext({
    groupId,
  });
  const { data, isLoading } = store.useChannel({
    id: channelId ?? '',
  });
  const { data: group } = store.useGroup({
    id: groupId ?? '',
  });
  const { navigateToChatDetails } = useRootNavigation();

  const handleGoBack = useCallback(() => {
    if (data?.id) {
      navigateToChatDetails({ type: 'channel', id: data.id });
    } else {
      navigation.goBack();
    }
  }, [navigation, navigateToChatDetails, data?.id]);

  const handleSubmit = useCallback(
    async (title: string, description?: string) => {
      const prevChannel = data;
      if (prevChannel) {
        // Keep existing reader/writer roles unchanged
        const existingReaders =
          prevChannel.readerRoles?.map((r) => r.roleId) ?? [];
        const existingWriters =
          prevChannel.writerRoles?.map((r) => r.roleId) ?? [];

        updateChannel(
          {
            ...prevChannel,
            title,
            description,
          },
          existingReaders,
          existingWriters
        );
        handleGoBack();
      }
    },
    [data, updateChannel, handleGoBack]
  );

  return (
    <EditChannelMetaScreenView
      goBack={handleGoBack}
      isLoading={isLoading}
      channel={data}
      group={group}
      onSubmit={handleSubmit}
    />
  );
}
