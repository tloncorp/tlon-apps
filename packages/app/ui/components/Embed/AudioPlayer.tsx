import { makePrettyTimeFromMs } from '@tloncorp/shared/logic';
import {
  AVPlaybackStatus,
  Audio as ExpoAudio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from 'expo-av';
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
import { Icon, LoadingSpinner, Pressable} from '@tloncorp/ui'

import { AudioPlayerHandle } from './AudioEmbedShared';

export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  { url: string; canUnload?: boolean }
>(function AudioPlayer({ url, canUnload }, forwardedRef) {
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus>();
  const [playbackError, setPlaybackError] = useState<string>();
  const [sound, setSound] = useState<ExpoAudio.Sound>();
  const progressBarWidthRef = useRef(0);

  useEffect(() => {
    ExpoAudio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
  }, []);

  useEffect(() => {
    const loadSound = async () => {
      const { sound: expoAudioSound } = await ExpoAudio.Sound.createAsync({
        uri: url,
      });
      setSound(expoAudioSound);
    };

    if (canUnload) {
      return () => {
        if (sound) {
          sound.unloadAsync();
          setSound(undefined);
        }
      };
    }

    if (!sound) {
      loadSound();
      return;
    }

    sound.setOnPlaybackStatusUpdate((status) => {
      setPlaybackStatus(status);
    });

    return () => {
      sound.unloadAsync();
      setSound(undefined);
    };
  }, [sound, url, canUnload]);

  const handlePlayPause = useCallback(async () => {
    if (!sound) {
      return { isPlaying: false };
    }

    if (!playbackStatus) {
      return { isPlaying: false };
    }

    if (!playbackStatus?.isLoaded) {
      if ('error' in playbackStatus) {
        console.error(playbackStatus.error);
        setPlaybackError(playbackStatus.error);
      }
      return { isPlaying: false };
    }

    if (playbackStatus.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
    return { isPlaying: !playbackStatus.isPlaying };
  }, [playbackStatus, sound]);

  const stop = useCallback(async () => {
    await sound?.stopAsync();
  }, [sound]);

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
            {playbackStatus?.isLoaded ? (
              playbackStatus?.isPlaying ? (
                <Icon type="Stop" size="$m" color="$primaryText" />
              ) : playbackStatus.isBuffering ? (
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
              {playbackStatus?.isLoaded
                ? playbackStatus.isPlaying
                  ? 'Now Playing'
                  : 'Audio Track'
                : 'Loading...'}
            </Text>
            {playbackStatus?.isLoaded && (
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
                      if (
                        sound &&
                        playbackStatus.durationMillis &&
                        progressBarWidthRef.current > 0
                      ) {
                        const { locationX } = e.nativeEvent;
                        const position =
                          (locationX / progressBarWidthRef.current) *
                          playbackStatus.durationMillis;
                        await sound.setPositionAsync(position);
                      }
                    }}
                  >
                    <View
                      backgroundColor="$primaryText"
                      height="100%"
                      width={`${(playbackStatus.positionMillis / (playbackStatus.durationMillis || 1)) * 100}%`}
                    />
                  </Pressable>
                </View>
                <Text color="$textMuted" fontSize="$s">
                  {makePrettyTimeFromMs(playbackStatus.positionMillis)}
                  {playbackStatus.durationMillis
                    ? ` / ${makePrettyTimeFromMs(playbackStatus.durationMillis)}`
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
