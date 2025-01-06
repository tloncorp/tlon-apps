import * as domain from '@tloncorp/shared/domain';
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: domain.NormalizedTrack | null;
  audio: HTMLAudioElement | null;
}

interface AudioPlayer {
  playTrack: (track: domain.NormalizedTrack) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  isPlaying: boolean;
  currentTrack: domain.NormalizedTrack | null;
}

const AudioPlayerContext = createContext<AudioPlayer | null>(null);

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    audio: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const playTrack = async (track: domain.NormalizedTrack) => {
    try {
      // If we're already playing this track, just pause/resume
      if (state.currentTrack?.id === track.id && audioRef.current) {
        if (state.isPlaying) {
          audioRef.current.pause();
          setState((prev) => ({ ...prev, isPlaying: false }));
        } else {
          await audioRef.current.play();
          setState((prev) => ({ ...prev, isPlaying: true }));
        }
        return;
      }

      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Create and play the new audio
      const audio = new Audio(track.audioUrl);
      audioRef.current = audio;

      // Set up event listeners
      audio.addEventListener('ended', () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      });

      audio.addEventListener('error', (e) => {
        console.error('Error playing audio:', e);
        setState((prev) => ({ ...prev, isPlaying: false }));
      });

      await audio.play();

      setState({
        audio,
        currentTrack: track,
        isPlaying: true,
      });
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const pause = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const resume = async () => {
    if (audioRef.current) {
      await audioRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  const stop = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
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
    throw new Error(
      'useAudioPlayer must be used within an AudioPlayerProvider'
    );
  }
  return context;
}
