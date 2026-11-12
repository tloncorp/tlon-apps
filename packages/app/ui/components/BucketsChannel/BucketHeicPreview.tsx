import { createDevLogger } from '@tloncorp/shared';
import { Pressable, Text } from '@tloncorp/ui';
import { useEffect, useRef, useState } from 'react';
import { Spinner, YStack } from 'tamagui';

import { BucketPreviewImage } from './BucketPreviewImage';
import { loadBucketHeicPreview } from './loadBucketHeicPreview';

const logger = createDevLogger('BucketHeicPreview', true);

// Only the web viewer imports this component. Native uses Expo's HEIC decoder.
export function BucketHeicPreview({
  uri,
  name,
  onLoad,
  onError,
  onRetry,
}: {
  uri: string;
  name: string;
  onLoad?: () => void;
  onError?: () => void;
  onRetry?: () => void;
}) {
  const [result, setResult] = useState<{
    uri: string;
    attempt: number;
    preview?: string;
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    loadBucketHeicPreview(uri, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ uri, attempt, preview: objectUrl });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const reason = error instanceof Error ? error.message : 'decode';
        logger.trackError('HEIC preview failed', { reason });
        setResult({
          uri,
          attempt,
          error:
            reason === 'size'
              ? 'This photo is too large to preview in the browser.'
              : 'Unable to preview this HEIC photo.',
        });
        onErrorRef.current?.();
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, attempt]);
  const current =
    result?.uri === uri && result.attempt === attempt ? result : undefined;
  if (current?.preview) {
    return (
      <BucketPreviewImage
        uri={current.preview}
        name={name}
        onLoad={onLoad}
        onError={onError}
        onRetry={onRetry}
      />
    );
  }
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$m"
      padding="$xl"
    >
      {current?.error ? (
        <>
          <Text color="$tertiaryText" textAlign="center">
            {current.error}
          </Text>
          <Text color="$tertiaryText" textAlign="center">
            You can still open the original from the file menu.
          </Text>
          <Pressable
            onPress={() => {
              setAttempt((value) => value + 1);
              onRetry?.();
            }}
            padding="$m"
          >
            <Text>Try again</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Spinner />
          <Text color="$tertiaryText">Preparing photo preview…</Text>
        </>
      )}
    </YStack>
  );
}
