import { makePrettyTimeFromMs } from '@tloncorp/shared/logic';
import { Icon, LoadingSpinner, Pressable } from '@tloncorp/ui';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GestureResponderEvent } from 'react-native';
import { Text, View } from 'tamagui';

import { AudioPlayerHandle } from './AudioEmbedShared';

export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  { url: string; canUnload?: boolean }
>(function AudioPlayer({ url }, forwardedRef) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const progressBarWidthRef = useRef(0);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    togglePlayPause: async () => {
      if (status.playing) {
        player.pause();
        return { isPlaying: false };
      }
      player.play();
      return { isPlaying: true };
    },
    stop: async () => {
      player.pause();
      player.seekTo(0);
    },
  }));

  const isLoaded = status.isLoaded;
  const positionMillis = status.currentTime * 1000;
  const durationMillis = status.duration ? status.duration * 1000 : 0;
  const playbackError = status.reasonForWaitingToPlay ?? null;

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
            {isLoaded ? (
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
              {isLoaded
                ? status.playing
                  ? 'Now Playing'
                  : 'Audio Track'
                : 'Loading...'}
            </Text>
            {isLoaded && (
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
                    onPress={async (e: GestureResponderEvent) => {
                      if (durationMillis && progressBarWidthRef.current > 0) {
                        const { locationX } = e.nativeEvent;
                        const positionSec =
                          (locationX / progressBarWidthRef.current) *
                          (durationMillis / 1000);
                        player.seekTo(positionSec);
                      }
                    }}
                  >
                    <View
                      backgroundColor="$primaryText"
                      height="100%"
                      width={`${(positionMillis / (durationMillis || 1)) * 100}%`}
                    />
                  </Pressable>
                </View>
                <Text color="$textMuted" fontSize="$s">
                  {makePrettyTimeFromMs(positionMillis)}
                  {durationMillis
                    ? ` / ${makePrettyTimeFromMs(durationMillis)}`
                    : null}
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
