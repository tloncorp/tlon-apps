import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { EditChannelScreenView } from '../../ui';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'EditChannel'>;

export function EditChannelScreen(props: Props) {
  const { groupId, channelId, fromChatDetails, selectedRoleIds } = props.route.params;
  const { navigation } = props;
  const { updateChannel, deleteChannel } = useGroupContext({
    groupId,
  });
  const { data, isLoading } = store.useChannel({
    id: channelId ?? '',
  });

  const handleGoBack = useCallback(() => {
    if (fromChatDetails) {
      navigation.getParent()?.navigate('ChatDetails', {
        chatType: 'group',
        chatId: groupId,
      });
    } else {
      navigation.goBack();
    }
  }, [navigation, fromChatDetails, groupId]);

  const handleDeleteChannel = useCallback(() => {
    const prevChannel = data;
    if (prevChannel) {
      deleteChannel(prevChannel.id);
      navigation.navigate('ManageChannels', {
        groupId,
        fromChatDetails,
      });
    }
  }, [data, deleteChannel, navigation, groupId, fromChatDetails]);

  const handleSubmit = useCallback(
    async (
      title: string,
      readers: string[],
      writers: string[],
      description?: string
    ) => {
      const prevChannel = data;
      if (prevChannel) {
        updateChannel(
          {
            ...prevChannel,
            title,
            description,
          },
          readers,
          writers
        );
        handleGoBack();
      }
    },
    [data, updateChannel, handleGoBack]
  );

  const handleSelectRoles = useCallback(() => {
    const readers = data?.readerRoles?.map((r) => r.roleId) ?? [];
    const selectedRoleIds =
      readers.length === 0 ? ['admin'] : readers.includes('admin') ? readers : ['admin', ...readers];

    navigation.navigate('SelectChannelRoles', {
      groupId,
      selectedRoleIds,
      returnScreen: 'EditChannel',
      returnParams: {
        groupId,
        channelId,
      },
    });
  }, [navigation, groupId, channelId, data?.readerRoles]);

  return (
    <EditChannelScreenView
      goBack={handleGoBack}
      isLoading={isLoading}
      channel={data}
      onDeleteChannel={handleDeleteChannel}
      onSubmit={handleSubmit}
      createdRoleId={props.route.params.createdRoleId}
      selectedRoleIds={selectedRoleIds}
      onCreateRole={() => {
        navigation.navigate('AddRole', {
          groupId,
          returnScreen: 'EditChannel',
          returnParams: {
            groupId,
            channelId,
          },
        });
      }}
      onSelectRoles={handleSelectRoles}
    />
  );
}
