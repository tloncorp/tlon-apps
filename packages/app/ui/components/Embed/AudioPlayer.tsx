import { makePrettyTimeFromMs } from '@tloncorp/shared/logic';
import { Icon, LoadingSpinner, Pressable } from '@tloncorp/ui';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { GestureResponderEvent } from 'react-native';
import { Text, View } from 'tamagui';

import { AudioPlayerHandle } from './AudioEmbedShared';

export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  { url: string; canUnload?: boolean }
>(function AudioPlayer({ url, canUnload }, forwardedRef) {
  const [playbackError, setPlaybackError] = useState<string>();
  const progressBarWidthRef = useRef(0);

  // expo-audio's hook lifecycle releases the player on unmount; passing a
  // null source mirrors the previous canUnload behavior of disposing without
  // remounting the component.
  const player = useAudioPlayer(canUnload ? null : { uri: url });
  const status = useAudioPlayerStatus(player);
  const durationMs = status.duration * 1000;
  const positionMs = status.currentTime * 1000;

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'duckOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!status.isLoaded) {
      return { isPlaying: false };
    }
    if (status.playing) {
      player.pause();
    } else {
      try {
        player.play();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        setPlaybackError(message);
        return { isPlaying: false };
      }
    }
    return { isPlaying: !status.playing };
  }, [player, status.isLoaded, status.playing]);

  const stop = useCallback(async () => {
    player.pause();
    player.seekTo(0);
  }, [player]);

  useImperativeHandle(forwardedRef, () => ({
    togglePlayPause: handlePlayPause,
    stop,
  }));

  return (
    <View padding="$m" borderRadius="$l" width="100%">
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        marginBottom="$s"
      >
        <View flexDirection="row" alignItems="center" flex={1}>
          <View
            backgroundColor="$backgroundStrong"
            borderRadius="$s"
            padding="$s"
            marginRight="$s"
          >
            {status.isLoaded ? (
              status.playing ? (
                <Icon type="Stop" size="$m" color="$primaryText" />
              ) : status.isBuffering ? (
                <LoadingSpinner size="small" />
              ) : (
                <Icon type="Play" size="$m" color="$primaryText" />
              )
            ) : (
              <LoadingSpinner size="small" />
            )}
          </View>
          <View flex={1}>
            <Text
              color="$text"
              fontSize="$m"
              fontWeight="$l"
              marginBottom="$xs"
            >
              {status.isLoaded
                ? status.playing
                  ? 'Now Playing'
                  : 'Audio Track'
                : 'Loading...'}
            </Text>
            {status.isLoaded && (
              <>
                <View
                  backgroundColor="$border"
                  height="$xs"
                  borderRadius="$xs"
                  marginBottom="$xs"
                  width="100%"
                  overflow="hidden"
                  onLayout={(e) => {
                    progressBarWidthRef.current = e.nativeEvent.layout.width;
                  }}
                >
                  <Pressable
                    onPress={(e: GestureResponderEvent) => {
                      if (durationMs && progressBarWidthRef.current > 0) {
                        const { locationX } = e.nativeEvent;
                        const positionSeconds =
                          (locationX / progressBarWidthRef.current) *
                          status.duration;
                        player.seekTo(positionSeconds);
                      }
                    }}
                  >
                    <View
                      backgroundColor="$primaryText"
                      height="100%"
                      width={`${(positionMs / (durationMs || 1)) * 100}%`}
                    />
                  </Pressable>
                </View>
                <Text color="$textMuted" fontSize="$s">
                  {makePrettyTimeFromMs(positionMs)}
                  {durationMs ? ` / ${makePrettyTimeFromMs(durationMs)}` : null}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
      {playbackError ? (
        <Text color="$error" fontSize="$s" textAlign="center">
          {playbackError}
        </Text>
      ) : null}
    </View>
  );
});
