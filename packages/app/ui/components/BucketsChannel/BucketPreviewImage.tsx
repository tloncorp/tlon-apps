import { Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { YStack } from 'tamagui';

import { BucketPreviewFade } from './BucketPreviewContent';

export function BucketPreviewImage({
  uri,
  name,
  animate = true,
  onLoad,
  onError,
  onRetry,
}: {
  uri: string;
  name: string;
  animate?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onRetry?: () => void;
}) {
  const [ready, setReady] = useState(false);
  return (
    <BucketPreviewFade ready={!animate || ready} animate={animate}>
      <Image
        source={{ uri }}
        cachePolicy="memory-disk"
        width="100%"
        height="100%"
        contentFit="contain"
        alt={name}
        onLoad={() => {
          setReady(true);
          onLoad?.();
        }}
        onError={() => {
          setReady(true);
          onError?.();
        }}
        fallback={
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            gap="$m"
            onLayout={() => setReady(true)}
          >
            <Icon type="Placeholder" color="$tertiaryText" />
            <Text color="$tertiaryText">Unable to load image</Text>
            {onRetry ? (
              <Pressable onPress={onRetry} padding="$m">
                <Text color="$primaryText">Try again</Text>
              </Pressable>
            ) : null}
          </YStack>
        }
      />
    </BucketPreviewFade>
  );
}
