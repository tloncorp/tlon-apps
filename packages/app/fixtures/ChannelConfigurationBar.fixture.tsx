import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  QueryClientProvider,
  queryClient,
} from '@tloncorp/shared';
import { UnconnectedChannelConfigurationBar as ChannelConfigurationBar } from '../ui/src/components/ManageChannels/CreateChannelSheet';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextArea, View } from 'tamagui';

import { tlonLocalIntros } from './fakeData';

const baseChannel = {
  ...tlonLocalIntros,
  contentConfiguration: {
    defaultPostCollectionRenderer: CollectionRendererId.chat,
    defaultPostContentRenderer: PostContentRendererId.chat,
    draftInput: { id: DraftInputId.chat },
  } as ChannelContentConfiguration,
};

export default function Basic() {
  const [channel, setChannel] = useState(baseChannel);

  return (
    <QueryClientProvider client={queryClient}>
      <View flex={1}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <TextArea editable={false} fontFamily={'$mono'} fontSize={'$s'}>
            {JSON.stringify(channel.contentConfiguration, null, 2)}
          </TextArea>
        </SafeAreaView>
      </View>
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
