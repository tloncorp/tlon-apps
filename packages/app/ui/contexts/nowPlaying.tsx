import {
  EventEmitter,
  TypedEventEmitter,
} from '@tloncorp/api/lib/EventEmitter';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import { useAppStatusChange } from '../../hooks/useAppStatusChange';
import { useNavigation } from '../../navigation/utils';

interface MediaItem {
  url: string;
}

export type PlaybackState =
  | { loadState: 'loaded'; duration: number; currentTime: number }
  | { loadState: 'loading' }
  | { loadState: 'empty' };

type NowPlayingEventMap = {
  progress: (event: PlaybackState) => void;
};

export interface NowPlayingValue extends TypedEventEmitter<NowPlayingEventMap> {
  replace: (nowPlaying: MediaItem | null) => void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  isPlaying: boolean;
  nowPlaying: MediaItem | null;
}

const ctx = createContext<NowPlayingValue | null>(null);

export function NowPlayingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = useNavigation();
  const audioPlayer = useAudioPlayer();
  const status = useAudioPlayerStatus(audioPlayer);

  type NavigationState = ReturnType<typeof navigation.getState>;
  type ReducerState = {
    mediaItem: MediaItem;
    navigationState: NavigationState;
  } | null;

  const [state, dispatch] = useReducer(
    (
      prev: ReducerState,
      action: {
        type: 'replace';
        nowPlaying: MediaItem | null;
      }
    ): ReducerState => {
      switch (action.type) {
        case 'replace':
          if (action.nowPlaying) {
            // replace right away so that caller can call `play` immediately
            audioPlayer.replace({ uri: action.nowPlaying.url });
            return {
              mediaItem: action.nowPlaying,
              navigationState: navigation.getState(),
            };
          } else {
            audioPlayer.replace(null);
            return null;
          }
      }
    },
    null
  );

  const eventEmitter = useMemo(
    () => new EventEmitter<NowPlayingEventMap>(),
    []
  );

  const ctxValue = useMemo(
    () => ({
      replace(nowPlaying: MediaItem | null) {
        dispatch({ type: 'replace', nowPlaying });
      },
      play() {
        audioPlayer.play();
      },
      pause() {
        audioPlayer.pause();
      },
      async seekTo(seconds: number) {
        await audioPlayer.seekTo(seconds);
      },
      nowPlaying: state?.mediaItem ?? null,
      isPlaying: status.playing && !status.didJustFinish,
      on: eventEmitter.on.bind(eventEmitter),
      off: eventEmitter.off.bind(eventEmitter),
      emit: eventEmitter.emit.bind(eventEmitter),
    }),
    [audioPlayer, state, status, eventEmitter]
  );

  // Emit progress updates and handle end of playback
  useEffect(() => {
    const subscription = audioPlayer.addListener(
      'playbackStatusUpdate',
      (status) => {
        if (status.didJustFinish) {
          audioPlayer.pause();
          audioPlayer.seekTo(0);
        }

        ctxValue.emit(
          'progress',
          status.isLoaded
            ? {
                loadState: 'loaded',
                currentTime: status.currentTime,
                duration: status.duration,
              }
            : { loadState: status.isBuffering ? 'loading' : 'empty' }
        );
      }
    );

    return () => {
      subscription.remove();
    };
  }, [audioPlayer, ctxValue]);

  // Stop audio when backgrounding the app
  useAppStatusChange(
    useCallback(
      (status) => {
        if (status === 'background') {
          audioPlayer.pause();
        }
      },
      [audioPlayer]
    )
  );

  // Stop audio when navigating away from initiating screen
  useEffect(() => {
    function shouldStopAudio(prev: NavigationState, next: NavigationState) {
      if (!prev || !next) {
        return false;
      }
      const prevRoute = prev.routes[prev.index];
      const nextRoute = next.routes[next.index];
      if (prevRoute.key !== nextRoute.key) {
        if (state?.navigationState) {
          const isPrevRouteActive =
            prevRoute.key ===
            state.navigationState.routes[state.navigationState.index].key;
          const isNextRouteActive =
            nextRoute.key ===
            state.navigationState.routes[state.navigationState.index].key;
          return isPrevRouteActive && !isNextRouteActive;
        }
      }
    }

    const unsub = navigation.addListener('state', (event) => {
      if (state && shouldStopAudio(state.navigationState, event.data.state)) {
        ctxValue.pause();
      }
    });
    return unsub;
  }, [navigation, ctxValue, state]);

  return <ctx.Provider value={ctxValue}>{children}</ctx.Provider>;
}

export function useNowPlaying() {
  const value = useContext(ctx);
  if (!value) {
    throw new Error('Must call `useNowPlaying` within a `NowPlayingProvider`');
  }
  return value;
}
