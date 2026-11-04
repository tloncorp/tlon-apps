import { NavigationContext } from '@react-navigation/native';
import { makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import { FilePreview, Icon, IconButton, Pressable, Text } from '@tloncorp/ui';
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Spinner, View, XStack, YStack } from 'tamagui';

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
  // The viewer keys this component by file: useAudioPlayer releases the player
  // on unmount, including when a swipe replaces a file still buffering.
  const player = useAudioPlayer({
    uri: item.uri,
    headers: { 'User-Agent': 'Tlon/1.0 (https://tlon.io)' },
  });
  const status = useAudioPlayerStatus(player);
  const navigation = useContext(NavigationContext);
  const nowPlaying = useOptionalNowPlaying();
  const active = useRef(true);
  const playbackRequest = useRef(0);
  const ownsAudioSession = useRef(false);
  const sourceFailureReported = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFailed, setSourceFailed] = useState(false);
  // Expo may clear status.error on its next progress event. Keep the failed
  // source retryable until the viewer replaces it with a fresh URI.
  if (status.error && !sourceFailed) setSourceFailed(true);
  const releaseAudioSession = useCallback(async () => {
    if (!ownsAudioSession.current) return;
    ownsAudioSession.current = false;
    await setIsAudioActiveAsync(false);
  }, []);
  useEffect(() => {
    active.current = true;
    const pause = () => {
      active.current = false;
      playbackRequest.current += 1;
      player.pause();
      void releaseAudioSession().catch(() => undefined);
    };
    const blur = navigation?.addListener('blur', pause);
    const focus = navigation?.addListener('focus', () => {
      active.current = true;
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') pause();
      else if (state === 'active')
        active.current = navigation?.isFocused() ?? true;
    });
    return () => {
      active.current = false;
      playbackRequest.current += 1;
      // useAudioPlayer releases the native player itself on unmount.
      void releaseAudioSession().catch(() => undefined);
      blur?.();
      focus?.();
      appState.remove();
    };
  }, [navigation, player, releaseAudioSession]);
  useEffect(() => {
    if (status.didJustFinish || sourceFailed)
      void releaseAudioSession().catch(() => undefined);
  }, [releaseAudioSession, status.didJustFinish, sourceFailed]);
  useEffect(() => {
    if (sourceFailed && !sourceFailureReported.current) {
      sourceFailureReported.current = true;
      onError?.();
    }
  }, [onError, sourceFailed]);

  const toggle = async () => {
    const request = ++playbackRequest.current;
    const isCurrent = () =>
      active.current && playbackRequest.current === request;
    setError(null);
    try {
      if (status.playing) {
        player.pause();
        ownsAudioSession.current = false;
        await setIsAudioActiveAsync(false);
        return;
      }
      // Stop voice memos and cancel a source still loading before this player
      // takes over. Pause deactivates global audio, so await it before activation.
      if (nowPlaying) {
        await nowPlaying.pause();
        if (!isCurrent()) return;
        await nowPlaying.replace(null);
        if (!isCurrent()) return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      if (!isCurrent()) return;
      // NowPlayingProvider deactivates the shared audio subsystem on background.
      ownsAudioSession.current = true;
      await setIsAudioActiveAsync(true);
      if (!isCurrent()) return;
      if (
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration)
      ) {
        await player.seekTo(0);
      }
      if (isCurrent()) player.play();
    } catch {
      if (isCurrent()) void releaseAudioSession().catch(() => undefined);
      if (isCurrent())
        setError('Couldn’t play this audio. Try opening it in another app.');
    }
  };
  const seek = (seconds: number) => {
    setError(null);
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
    (sourceFailed
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
      ) : null}
      {sourceFailed && onRetry ? (
        <Pressable
          accessibilityLabel="Retry audio"
          onPress={onRetry}
          padding="$m"
        >
          <Text color="$primaryText">Try again</Text>
        </Pressable>
      ) : null}
      {!playbackError && (!status.isLoaded || status.isBuffering) ? (
        <Spinner size="large" accessibilityLabel="Loading audio" />
      ) : null}
      {status.isLoaded || status.playing ? (
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
      ) : null}
    </YStack>
  );
}
