import * as domain from '@tloncorp/shared/domain';
import { AVPlaybackStatus, Audio } from 'expo-av';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: domain.NormalizedTrack | null;
  sound: Audio.Sound | null;
}

const AudioPlayerContext = createContext<domain.AudioPlayer | null>(null);

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    sound: null,
  });

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (state.sound) {
        state.sound.unloadAsync();
      }
    };
  }, []);

  const playTrack = async (track: domain.NormalizedTrack) => {
    try {
      // If we're already playing this track, just pause/resume
      if (state.currentTrack?.id === track.id && state.sound) {
        if (state.isPlaying) {
          await state.sound.pauseAsync();
          setState((prev) => ({ ...prev, isPlaying: false }));
        } else {
          await state.sound.playAsync();
          setState((prev) => ({ ...prev, isPlaying: true }));
        }
        return;
      }

      // Unload any existing sound
      if (state.sound) {
        await state.sound.unloadAsync();
      }

      // Load and play the new track
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          // This is our playback status callback
          if (status.isLoaded && status.didJustFinish) {
            setState((prev) => ({ ...prev, isPlaying: false }));
          }
        }
      );

      setState({
        sound,
        currentTrack: track,
        isPlaying: true,
      });
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const pause = async () => {
    if (state.sound) {
      await state.sound.pauseAsync();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const resume = async () => {
    if (state.sound) {
      await state.sound.playAsync();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  const stop = async () => {
    if (state.sound) {
      await state.sound.stopAsync();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const value = {
    playTrack,
    pause,
    resume,
    stop,
    isPlaying: state.isPlaying,
    currentTrack: state.currentTrack,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
