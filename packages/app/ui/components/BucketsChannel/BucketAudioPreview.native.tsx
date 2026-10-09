import { NavigationContext } from '@react-navigation/native';
import { makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import { FilePreview, Icon, IconButton, Pressable, Text } from '@tloncorp/ui';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Spinner, View, XStack, YStack } from 'tamagui';

import { BucketFileViewerItem } from './BucketFileViewer.shared';

export function BucketAudioPreview({
  item,
}: {
  item: BucketFileViewerItem & { uri: string };
}) {
  // The viewer keys this component by file: useAudioPlayer releases the player
  // on unmount, including when a swipe replaces a file still buffering.
  const player = useAudioPlayer({
    uri: item.uri,
    headers: { 'User-Agent': 'Tlon/1.0 (https://tlon.io)' },
  });
  const status = useAudioPlayerStatus(player);
  const navigation = useContext(NavigationContext);
  const active = useRef(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    active.current = true;
    const pause = () => {
      active.current = false;
      player.pause();
    };
    const blur = navigation?.addListener('blur', pause);
    const focus = navigation?.addListener('focus', () => {
      active.current = true;
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
      else active.current = navigation?.isFocused() ?? true;
    });
    return () => {
      active.current = false;
      blur?.();
      focus?.();
      appState.remove();
    };
  }, [navigation, player]);

  const toggle = async () => {
    setError(null);
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      if (!active.current) return;
      if (
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration)
      ) {
        await player.seekTo(0);
      }
      if (active.current) player.play();
    } catch {
      if (active.current)
        setError('Couldn’t play this audio. Try opening it in another app.');
    }
  };
  const seek = (seconds: number) => {
    void player
      .seekTo(
        Math.max(0, Math.min(status.duration, status.currentTime + seconds))
      )
      .catch(() => {
        if (active.current) setError('Couldn’t seek in this audio. Try again.');
      });
  };
  const playbackError =
    error ??
    (status.error
      ? 'Couldn’t play this audio. Try opening it in another app.'
      : null);
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
      <YStack alignItems="center" gap="$s">
        <Text size="$label/l" color="$primaryText" textAlign="center">
          {item.name}
        </Text>
        <Text size="$label/m" color="$secondaryText">
          {item.sizeLabel ?? 'Audio'}
        </Text>
      </YStack>
      {playbackError ? (
        <Text color="$negativeActionText" textAlign="center">
          {playbackError}
        </Text>
      ) : !status.isLoaded || status.isBuffering ? (
        <Spinner size="large" accessibilityLabel="Loading audio" />
      ) : (
        <YStack width="100%" maxWidth={360} gap="$l">
          <XStack alignItems="center" justifyContent="center" gap="$2xl">
            <Pressable
              accessibilityLabel="Rewind 15 seconds"
              onPress={() => seek(-15)}
              padding="$m"
            >
              <Text color="$secondaryText">−15 s</Text>
            </Pressable>
            <IconButton
              accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'}
              testID="BucketAudioPlayPause"
              onPress={() => void toggle()}
              size="$xl"
            >
              <Icon type={status.playing ? 'Stop' : 'Play'} />
            </IconButton>
            <Pressable
              accessibilityLabel="Forward 15 seconds"
              onPress={() => seek(15)}
              padding="$m"
            >
              <Text color="$secondaryText">+15 s</Text>
            </Pressable>
          </XStack>
          <View
            height={4}
            borderRadius="$m"
            backgroundColor="$border"
            overflow="hidden"
          >
            <View
              height="100%"
              width={`${status.duration > 0 ? Math.min(100, (status.currentTime / status.duration) * 100) : 0}%`}
              backgroundColor="$primaryText"
            />
          </View>
          <XStack justifyContent="space-between">
            <Text size="$label/s" color="$secondaryText">
              {makePrettyTimeFromMs(status.currentTime * 1000)}
            </Text>
            <Text size="$label/s" color="$secondaryText">
              {makePrettyTimeFromMs(status.duration * 1000)}
            </Text>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
