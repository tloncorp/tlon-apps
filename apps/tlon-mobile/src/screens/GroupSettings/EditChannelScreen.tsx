import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { EditChannelScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';

import { GroupSettingsStackParamList } from '../../types';
import { useGroupContext } from './useGroupContext';

type ManageChannelsScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannel'
>;

export function EditChannelScreen(props: ManageChannelsScreenProps) {
  const { groupId, channelId } = props.route.params;

  const { updateChannel, deleteChannel } = useGroupContext({
    groupId,
  });
  const { data, isLoading } = store.useChannel({
    id: channelId ?? '',
  });

  const handleDeleteChannel = useCallback(() => {
    const prevChannel = data;
    if (prevChannel) {
      deleteChannel(prevChannel.id);
      props.navigation.goBack();
    }
  }, [data, deleteChannel, props.navigation]);

  const handleSubmit = useCallback(
    (name: string, description: string) => {
      const prevChannel = data;
      if (prevChannel) {
        updateChannel({
          ...prevChannel,
          title: name,
          description,
        });
        props.navigation.goBack();
      }
    },
    [data, updateChannel, props.navigation]
  );

  return (
    <EditChannelScreenView
      goBack={props.navigation.goBack}
      isLoading={isLoading}
      channel={data}
      onDeleteChannel={handleDeleteChannel}
      onSubmit={handleSubmit}
    />
  );
}
