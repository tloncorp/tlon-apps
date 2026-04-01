import { useFocusEffect } from '@react-navigation/native';
import {
  EventEmitter,
  TypedEventEmitter,
} from '@tloncorp/api/lib/EventEmitter';
import { useMutableRef } from '@tloncorp/shared';
import { useEventEmitter } from '@tloncorp/shared/utils/useEventEmitter';
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
} from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { useAppStatusChange } from '../../hooks/useAppStatusChange';

// error if load takes longer than this
const REPLACE_TIMEOUT_MS = 10000;

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
  const audioPlayer = useAudioPlayer();

  const eventEmitter = useMemo(
    () => new EventEmitter<NowPlayingEventMap>(),
    []
  );

  // Use refs for reactive state so the context value can remain stable.
  // This is the key perf optimization: a stable context reference means
  // useContext(ctx) consumers don't re-render on every audio tick.
  const mediaItemRef = useRef<MediaItem | null>(null);
  const isPlayingRef = useRef(false);
  const replaceGenRef = useRef(0);

  const ctxValue = useMemo(
    () => ({
      replace(nowPlaying: MediaItem | null) {
        const gen = ++replaceGenRef.current;
        const hadPreviousSource = mediaItemRef.current != null;

        // Clear ref during transition so progress events aren't
        // misattributed to the new source while the old one unloads
        mediaItemRef.current = null;

        if (!nowPlaying) {
          audioPlayer.replace(null);
          return Promise.resolve();
        }

        // We requested a replace - we need to return a promise that
        // resolves once the new audio source loads in. Set up a listener now,
        // before we call replace. This seems like the only way to detect when
        // the source swaps out:
        const cleanups: (() => void)[] = [];
        const out = new Promise<void>((resolve, reject) => {
          // Set up a timeout in case we don't get our expo-audio event
          let timedOut = false;
          const timeout = setTimeout(() => {
            timedOut = true;
            reject(new Error('Loading audio timed out'));
          }, REPLACE_TIMEOUT_MS);
          cleanups.push(() => clearTimeout(timeout));

          // If we didn't have something loaded before, we can resolve as soon
          // as we see isLoaded=true.
          // But otherwise, we need to first see the old source unload
          // (isLoaded=false) before resolving on an isLoaded=true.
          // (We don't know *which* source is loaded.)
          let seenUnloaded = !hadPreviousSource;

          const unsub = audioPlayer.addListener(
            'playbackStatusUpdate',
            (status) => {
              if (timedOut) {
                // shouldn't hit this, but abort just in case
                return;
              }

              // Superseded by a newer replace() call — abandon
              if (replaceGenRef.current !== gen) {
                reject(
                  new Error('Audio source replaced before loading completed')
                );
                return;
              }
              if (!status.isLoaded) {
                seenUnloaded = true;
              }
              if (status.isLoaded && seenUnloaded) {
                // New source confirmed loaded — safe to attribute events
                mediaItemRef.current = nowPlaying;
                resolve();
              }
            }
          );
          cleanups.push(() => unsub.remove());
        }).finally(() => {
          cleanups.forEach((fn) => fn());
        });

        // this shouldn't be necessary, but on web, `replace()` is implemented
        // by creating a new Audio element, which means the previous one will
        // stay alive/playing if not paused.
        audioPlayer.pause();

        audioPlayer.replace({
          uri: nowPlaying.url,
          headers: {
            // android exo-player requests with no user-agent, which 403s
            // on a lot of servers. add something.
            'User-Agent': 'Tlon/1.0 (https://tlon.io)',
          },
        });

        return out;
      },
      async play() {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
        });
        await setIsAudioActiveAsync(true);
        audioPlayer.play();
      },
      async pause() {
        audioPlayer.pause();
        isPlayingRef.current = false;

        // Emit synthetic progress immediately so the UI updates without
        // waiting for the next native playbackStatusUpdate tick
        if (mediaItemRef.current) {
          eventEmitter.emit('progress', {
            sourceUrl: mediaItemRef.current.url,
            isPlaying: false,
            loadState: 'loaded',
            currentTime: toSeconds(audioPlayer.currentTime),
            duration: toSeconds(audioPlayer.duration),
          });
        }

        await setIsAudioActiveAsync(false);
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
      async (status) => {
        if (status.didJustFinish) {
          audioPlayer.pause();
          audioPlayer.seekTo(0);
          await setIsAudioActiveAsync(false);
        }

        const isPlaying = status.playing && !status.didJustFinish;
        isPlayingRef.current = isPlaying;

        const playback: PlaybackState = status.isLoaded
          ? {
              loadState: 'loaded',
              currentTime: toSeconds(status.currentTime),
              duration: toSeconds(status.duration),
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
      async (status) => {
        if (status === 'background') {
          audioPlayer.pause();
          await setIsAudioActiveAsync(false);
        }
      },
      [audioPlayer]
    )
  );

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

  // Tracks our *intent* to play, covering the gaps before expo-audio
  // confirms via playbackStatusUpdate:
  //  - "will-buffer": replace() called, waiting for first status update
  //  - "will-play": play() called on an already-loaded source
  const [playbackIntent, setPlaybackIntent] = useState<
    false | 'will-play' | 'will-buffer'
  >(false);

  // When the source is already loaded, we optimistically show "playing"
  // instead of a spinner. If the native ack takes longer than 200ms,
  // escalate to a spinner so the user knows something is happening.
  useEffect(() => {
    if (playbackIntent !== 'will-play') return;
    const timer = setTimeout(() => {
      setPlaybackIntent((cur) => (cur === 'will-play' ? 'will-buffer' : cur));
    }, 200);
    return () => clearTimeout(timer);
  }, [playbackIntent]);

  // Filter progress events by source URL: only update state (and thus
  // re-render) when the event is relevant to this block's source.
  const progressReducer = useCallback(
    (prev: NowPlayingProgress | null, [event]: [NowPlayingProgress]) => {
      const isRelevant = sourceUri != null && event.sourceUrl === sourceUri;
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

  // Clear playback intent once expo-audio confirms playback started,
  // or if another source took over (isThisSourceLoaded was true, now false).
  const wasLoadedRef = useRef(false);
  if (isThisSourceLoaded) {
    wasLoadedRef.current = true;
  }
  useEffect(() => {
    if (!playbackIntent) return;
    if (progress?.isPlaying) {
      setPlaybackIntent(false);
      wasLoadedRef.current = false;
    } else if (wasLoadedRef.current && !isThisSourceLoaded) {
      // We had a progress event for our source, but now it's gone —
      // another source replaced us.
      setPlaybackIntent(false);
      wasLoadedRef.current = false;
    }
  }, [playbackIntent, progress, isThisSourceLoaded]);

  const togglePlayback = useCallback(() => {
    if (sourceUri == null) return;
    if (isThisSourceLoaded) {
      // Already loaded - either pause or request play (which might require buffering)
      if (nowPlaying.isPlaying) {
        setPlaybackIntent(false);
        nowPlaying.pause();
      } else {
        setPlaybackIntent('will-play');
        nowPlaying.play();
      }
    } else {
      // Not yet loaded - load and play the new source

      // Reset so stale wasLoadedRef from a previous playback session
      // doesn't cause the effect to immediately clear the new intent
      wasLoadedRef.current = false;
      setPlaybackIntent('will-buffer');
      nowPlaying
        .replace({ url: sourceUri })
        .then(() => {
          nowPlaying.play();
        })
        .catch((e) => {
          console.error('Failed to load voice memo', e);
          setPlaybackIntent(false);
        });
    }
  }, [nowPlaying, sourceUri, isThisSourceLoaded]);

  const status = useMemo<null | 'playing' | 'paused' | 'loading'>(() => {
    // Playback requested but not confirmed by expo-audio yet
    if (playbackIntent && !progress?.isPlaying) {
      // Already-loaded source: optimistically show "playing" (the timer
      // will escalate to 'will-buffer' → spinner after 200ms if needed)
      return playbackIntent === 'will-play' ? 'playing' : 'loading';
    }
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
  }, [playbackIntent, progress, isThisSourceLoaded]);

  const statusRef = useMutableRef(status);
  const nowPlayingRef = useMutableRef(nowPlaying);
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (statusRef.current === 'playing') {
          nowPlayingRef.current.pause();
        }
      };
    }, [nowPlayingRef, statusRef])
  );

  return {
    togglePlayback,
    progress,
    status,
    isThisSourceLoaded,
  };
}

function toSeconds(expoAudioUnit: number): number {
  if (Platform.OS === 'web') {
    // web is in milliseconds!
    return expoAudioUnit / 1000;
  } else {
    return expoAudioUnit;
  }
}
