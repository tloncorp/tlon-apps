import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { YStack } from 'tamagui';

import { BucketsLiveChannel } from '../../features/buckets/BucketsLiveChannel';
import type { RootStackParamList } from '../../navigation/types';
import { ChannelHeader, ChannelHeaderItemsProvider } from '../../ui';
import { BucketsGate } from '../../ui/components/BucketsChannel/BucketsPostCollection';

type Props = NativeStackScreenProps<RootStackParamList, 'BucketFolder'>;

export function BucketFolderScreen(props: Props) {
  const { channelId, folderId } = props.route.params;
  const { channel, group } = store.useChannelContext({
    channelId,
    draftKey: channelId,
  });
  // Read off the manifest rather than carried in the params, so a rename
  // shows here as it does in the list behind.
  const { data: bucket } = store.useBucket({ channelId });
  const folderName = bucket?.entries.find(
    (entry) => entry.entryId === folderId
  )?.name;

  if (!channel) {
    return null;
  }

  return (
    <ChannelHeaderItemsProvider>
      <YStack flex={1} backgroundColor="$background">
        <ChannelHeader
          channel={channel}
          group={group}
          title={folderName ?? ''}
          description=""
          goBack={() => props.navigation.goBack()}
          hideIdentity
          preferProvidedTitle
        />
        {/* The embedded view fills its parent's height, so it gets the space
            left under the header rather than the screen's. */}
        <YStack flex={1} minHeight={0}>
          <BucketsGate channelId={channelId}>
            {(flag) => (
              <BucketsLiveChannel
                channel={channel}
                embedded
                flag={flag}
                folderId={folderId}
              />
            )}
          </BucketsGate>
        </YStack>
      </YStack>
    </ChannelHeaderItemsProvider>
  );
}
