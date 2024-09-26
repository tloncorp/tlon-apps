import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { EditChannelScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'EditChannel'>;

export function EditChannelScreen(props: Props) {
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
    (title: string, description?: string) => {
      const prevChannel = data;
      if (prevChannel) {
        updateChannel({
          ...prevChannel,
          title,
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
