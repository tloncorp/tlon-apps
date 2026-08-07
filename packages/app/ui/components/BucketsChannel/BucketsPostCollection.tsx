import { parseBucketsChannelId } from '@tloncorp/api';
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

    if (!flag) {
      return (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text color="$secondaryText">This Bucket address is invalid.</Text>
        </YStack>
      );
    }

    return <BucketsLiveChannel channel={channel} embedded flag={flag} />;
  }
);
