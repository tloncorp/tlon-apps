import {
  EventEmitter,
  TypedEventEmitter,
} from '@tloncorp/api/lib/EventEmitter';
import { useEventEmitter } from '@tloncorp/shared/utils/useEventEmitter';
import { useAudioPlayer } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { useAppStatusChange } from '../../hooks/useAppStatusChange';
import { useNavigation } from '../../navigation/utils';

interface MediaItem {
  url: string;
}

export type PlaybackState =
  | { loadState: 'loaded'; duration: number; currentTime: number }
  | { loadState: 'loading' }
  | {
      /** no source loaded */
      loadState: 'empty';
    };

export type NowPlayingProgress = PlaybackState & {
  sourceUrl: string | null;
  isPlaying: boolean;
};

type NowPlayingEventMap = {
  progress: (event: NowPlayingProgress) => void;
};

export interface NowPlayingValue extends TypedEventEmitter<NowPlayingEventMap> {
  /** @returns promise that resolves when media item is loaded (rejects if fails to load) */
  replace: (nowPlaying: MediaItem | null) => Promise<void>;
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

  // Use refs for reactive state so the context value can remain stable.
  // This is the key perf optimization: a stable context reference means
  // useContext(ctx) consumers don't re-render on every audio tick.
  const mediaItemRef = useRef<MediaItem | null>(null);
  const isPlayingRef = useRef(false);

  const ctxValue = useMemo(
    () => ({
      replace(nowPlaying: MediaItem | null) {
        // Update ref immediately so progress events have the right source
        // before the React state update commits
        mediaItemRef.current = nowPlaying;
        dispatch({ type: 'replace', nowPlaying });
        if (!nowPlaying) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          const unsub = audioPlayer.addListener(
            'playbackStatusUpdate',
            (status) => {
              if (status.isLoaded) {
                resolve();
                unsub.remove();
              }
            }
          );
        });
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
      get nowPlaying() {
        return mediaItemRef.current;
      },
      get isPlaying() {
        return isPlayingRef.current;
      },
      on: eventEmitter.on.bind(eventEmitter),
      off: eventEmitter.off.bind(eventEmitter),
      emit: eventEmitter.emit.bind(eventEmitter),
    }),
    // Only stable deps - audioPlayer and eventEmitter don't change
    [audioPlayer, eventEmitter]
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

        const isPlaying = status.playing && !status.didJustFinish;
        isPlayingRef.current = isPlaying;

        const playback: PlaybackState = status.isLoaded
          ? {
              loadState: 'loaded',
              currentTime: status.currentTime,
              duration: status.duration,
            }
          : { loadState: status.isBuffering ? 'loading' : 'empty' };

        ctxValue.emit('progress', {
          ...playback,
          sourceUrl: mediaItemRef.current?.url ?? null,
          isPlaying,
        });
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

/** Provides a controller for loading + controlling playback of the given
 * source URI, using the contextual singleton "now playing" media player. This
 * does *not* automatically load the file or start playback (so you can have
 * multiple of these in a tree and they won't try to steal "now playing"). */
export function useNowPlayingController({
  sourceUri,
}: {
  sourceUri: string | null;
}) {
  const nowPlaying = useNowPlaying();

  // Filter progress events by source URL: only update state (and thus
  // re-render) when the event is relevant to this block's source.
  const progressReducer = useCallback(
    (prev: NowPlayingProgress | null, [event]: [NowPlayingProgress]) => {
      const isRelevant =
        sourceUri != null && event.sourceUrl === sourceUri;
      const wasRelevant =
        prev != null && sourceUri != null && prev.sourceUrl === sourceUri;

      if (!isRelevant && !wasRelevant) {
        // Not relevant to this block - return same reference to skip re-render
        return prev;
      }

      if (!isRelevant && wasRelevant) {
        // Source changed away from us, clear our state
        return null;
      }

      // This is our source, update
      return event;
    },
    [sourceUri]
  );

  const progress = useEventEmitter(
    nowPlaying,
    'progress',
    progressReducer,
    null as null | NowPlayingProgress
  );

  const isThisSourceLoaded =
    sourceUri != null && progress?.sourceUrl === sourceUri;

  const togglePlayback = useCallback(() => {
    if (sourceUri == null) return;
    if (isThisSourceLoaded) {
      if (nowPlaying.isPlaying) {
        nowPlaying.pause();
      } else {
        nowPlaying.play();
      }
    } else {
      nowPlaying
        .replace({ url: sourceUri })
        .then(() => {
          nowPlaying.play();
        })
        .catch((e) => {
          console.error('Failed to load voice memo', e);
        });
    }
  }, [nowPlaying, sourceUri, isThisSourceLoaded]);

  const status = useMemo<null | 'playing' | 'paused' | 'loading'>(() => {
    if (
      !isThisSourceLoaded ||
      progress == null ||
      progress.loadState === 'empty'
    ) {
      return null;
    }
    switch (progress.loadState) {
      case 'loaded':
        return progress.isPlaying ? 'playing' : 'paused';
      case 'loading':
        return 'loading';
    }
  }, [progress, isThisSourceLoaded]);

  return {
    togglePlayback,
    progress,
    status,
    isThisSourceLoaded,
  };
}
