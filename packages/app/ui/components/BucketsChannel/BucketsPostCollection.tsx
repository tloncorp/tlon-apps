import { parseBucketsChannelId } from '@tloncorp/api';
import { useDeskSupportsBuckets } from '@tloncorp/shared';
import { Text } from '@tloncorp/ui';
import { forwardRef } from 'react';
import { YStack } from 'tamagui';

import { BucketsLiveChannel } from '../../../features/buckets/BucketsLiveChannel';
import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';

export const BucketsPostCollection: IPostCollectionView = forwardRef(
  function BucketsPostCollection() {
    const { channel } = usePostCollectionContext();
    const flag = parseBucketsChannelId(channel.id);
    // Gated here rather than in the channel list because this is the one
    // place every way into a Bucket lands -- the list, activity, a pin, a deep
    // link, a restored route. The live view is what talks to %buckets, so a
    // ship without it must never mount one.
    const deskSupportsBuckets = useDeskSupportsBuckets();

    if (!flag) {
      return (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text color="$secondaryText">This Bucket address is invalid.</Text>
        </YStack>
      );
    }

    if (deskSupportsBuckets === undefined) {
      return null;
    }

    if (!deskSupportsBuckets) {
      return (
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          paddingHorizontal="$2xl"
          testID="BucketsUnsupportedNotice"
        >
          <Text color="$secondaryText" textAlign="center">
            Opening Buckets needs a newer version of the Tlon backend on your
            ship.
          </Text>
        </YStack>
      );
    }

    // Keyed on the channel, because ChannelScreen can switch straight from
    // one Bucket to another without changing renderer. Reused, the pane keeps
    // the previous Bucket's snapshot, open folder, preview and upload rows
    // while its callbacks already carry the new flag -- so a rename or delete
    // in that window lands on whichever entry happens to share that numeric
    // id in the Bucket now selected. Entry ids are per-Bucket, so a collision
    // is ordinary rather than unlucky.
    return (
      <BucketsLiveChannel
        key={channel.id}
        channel={channel}
        embedded
        flag={flag}
      />
    );
  }
);
