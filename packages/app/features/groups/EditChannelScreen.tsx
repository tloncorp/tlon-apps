import * as store from '@tloncorp/shared/dist/store';
import { EditChannelScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';

export function EditChannelScreen({
  groupId,
  channelId,
  onGoBack,
}: {
  groupId: string;
  channelId: string;
  onGoBack: () => void;
}) {
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
      onGoBack();
    }
  }, [data, deleteChannel, onGoBack]);

  const handleSubmit = useCallback(
    (name: string, description: string) => {
      const prevChannel = data;
      if (prevChannel) {
        updateChannel({
          ...prevChannel,
          title: name,
          description,
        });
        onGoBack();
      }
    },
    [data, updateChannel, onGoBack]
  );

  return (
    <EditChannelScreenView
      goBack={onGoBack}
      isLoading={isLoading}
      channel={data}
      onDeleteChannel={handleDeleteChannel}
      onSubmit={handleSubmit}
    />
  );
}
