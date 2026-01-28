import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { EditChannelMetaScreenView } from '../../ui/components/ManageChannels/EditChannelMetaScreenView';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannelMeta'
>;

export function EditChannelMetaScreen(props: Props) {
  const { groupId, channelId, fromChannelInfo } = props.route.params;
  const { navigation } = props;

  // When coming from ChannelInfo in GroupSettingsStack, use simple goBack
  // Otherwise, let useChannelEditScreen handle desktop-specific navigation
  const simpleGoBack = useCallback(() => navigation.goBack(), [navigation]);

  const { channel, group, isLoading, updateChannel, handleGoBack } =
    useChannelEditScreen({
      groupId,
      channelId,
      customGoBack: fromChannelInfo ? simpleGoBack : undefined,
    });

  const handleSubmit = useCallback(
    async (title: string, description?: string) => {
      if (channel) {
        // Keep existing reader/writer roles unchanged
        const existingReaders =
          channel.readerRoles?.map((r) => r.roleId) ?? [];
        const existingWriters =
          channel.writerRoles?.map((r) => r.roleId) ?? [];

        updateChannel(
          {
            ...channel,
            title,
            description,
          },
          existingReaders,
          existingWriters
        );
        handleGoBack();
      }
    },
    [channel, updateChannel, handleGoBack]
  );

  return (
    <EditChannelMetaScreenView
      goBack={handleGoBack}
      isLoading={isLoading}
      channel={channel}
      group={group}
      onSubmit={handleSubmit}
    />
  );
}
