import { FilePreview, Text } from '@tloncorp/ui';
import { useEffect, useRef, useState } from 'react';
import { YStack } from 'tamagui';

import { BucketFileViewerItem } from './BucketFileViewer.shared';

export function BucketAudioPreview({
  item,
}: {
  item: BucketFileViewerItem & { uri: string };
}) {
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = audio.current;
    return () => element?.pause();
  }, []);
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$2xl"
      padding="$2xl"
    >
      <FilePreview
        size="m"
        fileExtensionLabel={
          FilePreview.fileExtensionFrom({
            filename: item.name,
            mimeType: item.mimeType,
          }) ?? undefined
        }
      />
      <Text size="$label/l" textAlign="center">
        {item.name}
      </Text>
      {failed ? (
        <Text color="$secondaryText" textAlign="center">
          Couldn’t play this audio. Try opening it in another app.
        </Text>
      ) : (
        <audio
          ref={audio}
          src={item.uri}
          controls
          preload="metadata"
          aria-label={item.name}
          onError={() => setFailed(true)}
          style={{ width: '100%', maxWidth: 420 }}
        />
      )}
    </YStack>
  );
}
