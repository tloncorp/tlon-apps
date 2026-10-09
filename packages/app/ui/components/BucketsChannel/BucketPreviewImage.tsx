import { Icon, Image, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { YStack } from 'tamagui';

import { BucketPreviewFade } from './BucketPreviewContent';

export function BucketPreviewImage({
  uri,
  name,
}: {
  uri: string;
  name: string;
}) {
  const [ready, setReady] = useState(false);
  return (
    <BucketPreviewFade ready={ready}>
      <Image
        source={{ uri }}
        width="100%"
        height="100%"
        contentFit="contain"
        alt={name}
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        fallback={
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            onLayout={() => setReady(true)}
          >
            <Icon type="Placeholder" color="$tertiaryText" />
            <Text color="$tertiaryText">Unable to load image</Text>
          </YStack>
        }
      />
    </BucketPreviewFade>
  );
}
