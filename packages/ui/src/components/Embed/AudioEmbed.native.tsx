import { makePrettyTimeFromMs } from '@tloncorp/shared/src/logic';
import {
  AVPlaybackStatus,
  Audio as ExpoAudio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'tamagui';

import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';
import { Embed } from './Embed';

export default function AudioEmbed({ url }: { url: string }) {
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus>();
  const [playbackError, setPlaybackError] = useState<string>();
  const [sound, setSound] = useState<ExpoAudio.Sound>();
  const [showModal, setShowModal] = useState(false);

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

    if (!showModal) {
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
  }, [sound, url, showModal]);

  useEffect(() => {
    if (showModal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [showModal]);

  const handlePlayPause = useCallback(async () => {
    if (!sound) {
      return;
    }

    if (playbackStatus?.isLoaded) {
      if (playbackStatus.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } else if (playbackStatus?.error) {
      console.error(playbackStatus.error);
      setPlaybackError(playbackStatus.error);
    }
  }, [playbackStatus, sound]);

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
        onPress={handlePlayPause}
        visible={showModal}
        onDismiss={() => setShowModal(false)}
      >
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
      </Embed.Modal>
    </Embed>
  );
}
