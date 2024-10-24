import { makePrettyTimeFromMs } from '@tloncorp/shared/src/logic';
import {
  AVPlaybackStatus,
  Audio as ExpoAudio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from 'expo-av';
import * as Haptics from 'expo-haptics';
import {
  ElementRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'tamagui';

import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';
import * as shared from './AudioEmbedShared';
import { Embed } from './Embed';

const AudioEmbed: shared.AudioEmbed = ({ url }: { url: string }) => {
  const [showModal, setShowModal] = useState(false);
  const playerRef = useRef<ElementRef<typeof AudioPlayer>>(null);

  useEffect(() => {
    if (showModal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [showModal]);

  return (
    <Embed height={100}>
      <Embed.Header onPress={() => ({})}>
        <Embed.Title>Audio</Embed.Title>
        <Embed.PopOutIcon />
      </Embed.Header>
      <Embed.Preview onPress={() => setShowModal(true)}>
        <Icon type="Play" />
        <Text>Listen</Text>
      </Embed.Preview>
      <Embed.Modal
        onPress={useCallback(() => playerRef.current?.togglePlayPause(), [])}
        visible={showModal}
        onDismiss={() => setShowModal(false)}
      >
        <AudioPlayer ref={playerRef} url={url} canUnload={!showModal} />
      </Embed.Modal>
    </Embed>
  );
};
export default AudioEmbed;

export const AudioPlayer = forwardRef<
  { togglePlayPause: () => void },
  { url: string; canUnload?: boolean }
>(function AudioPlayer({ url, canUnload }, forwardedRef) {
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus>();
  const [playbackError, setPlaybackError] = useState<string>();
  const [sound, setSound] = useState<ExpoAudio.Sound>();

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
    };
  }, [sound, url, canUnload]);

  const handlePlayPause = useCallback(async () => {
    if (!sound) {
      return { isPlaying: false };
    }

    if (playbackStatus?.isLoaded) {
      if (playbackStatus.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      return { isPlaying: !playbackStatus.isPlaying };
    } else if (playbackStatus?.error) {
      console.error(playbackStatus.error);
      setPlaybackError(playbackStatus.error);
      return { isPlaying: false };
    }
  }, [playbackStatus, sound]);

  const stop = useCallback(async () => {
    await sound?.stopAsync();
  }, [sound]);

  useImperativeHandle(forwardedRef, () => ({
    togglePlayPause: handlePlayPause,
    stop,
  }));

  return (
    <View>
      {playbackStatus?.isLoaded ? (
        playbackStatus?.isPlaying ? (
          <Icon type="Stop" />
        ) : playbackStatus.isBuffering ? (
          <View
            width="$3xl"
            height="$3xl"
            paddingVertical="$s"
            paddingHorizontal="$l"
          >
            <LoadingSpinner />
          </View>
        ) : (
          <Icon type="Play" />
        )
      ) : (
        <View
          width="$3xl"
          height="$3xl"
          paddingVertical="$s"
          paddingHorizontal="$l"
        >
          <LoadingSpinner />
        </View>
      )}
      <Text>
        {playbackStatus?.isLoaded
          ? playbackStatus.isPlaying
            ? 'Playing'
            : 'Listen'
          : 'Loading'}
      </Text>
      {playbackStatus?.isLoaded && (
        <Text>
          {makePrettyTimeFromMs(playbackStatus.positionMillis)}
          {playbackStatus.durationMillis
            ? ` / ${makePrettyTimeFromMs(playbackStatus.durationMillis)}`
            : null}
        </Text>
      )}
      {playbackError ? <Text>{playbackError}</Text> : null}
    </View>
  );
});
