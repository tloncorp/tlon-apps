import { FilePreview, Pressable, Text } from '@tloncorp/ui';
import { useEffect, useRef, useState } from 'react';
import { YStack } from 'tamagui';

import { useOptionalNowPlaying } from '../../contexts/nowPlaying';
import { BucketFileViewerItem } from './BucketFileViewer.shared';

export function BucketAudioPreview({
  item,
  onError,
  onRetry,
}: {
  item: BucketFileViewerItem & { uri: string };
  onError?: () => void;
  onRetry?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const nowPlaying = useOptionalNowPlaying();
  const handleError = () => {
    audio.current?.pause();
    setFailed(true);
    onError?.();
  };
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
        <YStack alignItems="center" gap="$m">
          <Text color="$secondaryText" textAlign="center">
            Couldn’t play this audio. Try opening it in another app.
          </Text>
          {onRetry ? (
            <Pressable
              aria-label="Retry audio"
              accessibilityLabel="Retry audio"
              role="button"
              onPress={onRetry}
              padding="$m"
            >
              <Text color="$primaryText">Try again</Text>
            </Pressable>
          ) : null}
        </YStack>
      ) : (
        <audio
          ref={audio}
          src={item.uri}
          controls
          preload="metadata"
          aria-label={item.name}
          onPlay={async () => {
            try {
              // Clearing also cancels a voice memo that is still loading.
              await nowPlaying?.replace(null);
            } catch {
              handleError();
            }
          }}
          onError={handleError}
          style={{ width: '100%', maxWidth: 420 }}
        />
      )}
    </YStack>
  );
}
