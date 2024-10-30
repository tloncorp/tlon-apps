import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  QueryClientProvider,
  queryClient,
} from '@tloncorp/shared';
import { UnconnectedChannelConfigurationBar as ChannelConfigurationBar } from '@tloncorp/ui/src/components/ManageChannels/CreateChannelSheet';
import { useState } from 'react';
import { View } from 'tamagui';

import { tlonLocalIntros } from './fakeData';

const baseChannel = {
  ...tlonLocalIntros,
  contentConfiguration: {
    defaultPostCollectionRenderer: { id: CollectionRendererId.chat },
    defaultPostContentRenderer: { id: PostContentRendererId.chat },
    draftInput: { id: DraftInputId.chat },
  } as ChannelContentConfiguration,
};

export default function Basic() {
  const [channel, setChannel] = useState(baseChannel);

  return (
    <QueryClientProvider client={queryClient}>
      <View flex={1} />
      <ChannelConfigurationBar
        channel={channel}
        updateChannelConfiguration={(update) => {
          setChannel((prev) => ({
            ...prev,
            contentConfiguration: update(
              prev.contentConfiguration ?? undefined
            ),
          }));
        }}
      />
    </QueryClientProvider>
  );
}
