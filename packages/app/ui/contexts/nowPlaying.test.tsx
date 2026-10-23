import { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import {
  NowPlayingProvider,
  NowPlayingValue,
  useNowPlaying,
  useNowPlayingController,
} from './nowPlaying';

const mocks = vi.hoisted(() => {
  const listeners = new Set<(status: Record<string, unknown>) => void>();
  return {
    listeners,
    mode: vi.fn(() => Promise.resolve()),
    activate: vi.fn(() => Promise.resolve()),
    player: {
      pause: vi.fn(),
      play: vi.fn(),
      replace: vi.fn((source: unknown) => {
        // Match the native Expo Audio bridge: replace requires a source record.
        if (source === null) throw new Error('Expected an AudioSource record');
      }),
      addListener: vi.fn(
        (
          _name: string,
          listener: (status: Record<string, unknown>) => void
        ) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) };
        }
      ),
    },
  };
});
vi.mock('expo-audio', () => ({
  useAudioPlayer: () => mocks.player,
  setAudioModeAsync: mocks.mode,
  setIsAudioActiveAsync: mocks.activate,
}));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: vi.fn() }));
vi.mock('@tloncorp/shared', () => import('@tloncorp/shared/logic/utilHooks'));
vi.mock('../../hooks/useAppStatusChange', () => ({
  useAppStatusChange: vi.fn(),
}));
setupReactTestEnvironment();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.mode.mockResolvedValue(undefined);
  mocks.activate.mockResolvedValue(undefined);
});

function emit(status: Record<string, unknown>) {
  for (const listener of mocks.listeners) listener(status);
}

function render() {
  let playback!: NowPlayingValue;
  function Consumer() {
    const value = useNowPlaying();
    useLayoutEffect(() => {
      playback = value;
    }, [value]);
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <NowPlayingProvider>
        <Consumer />
      </NowPlayingProvider>
    );
  });
  return { playback, tree };
}

it('stops and clears a shared source using a native-compatible record', async () => {
  const { playback, tree } = render();
  await act(async () => {
    const loaded = playback.replace({ url: 'https://files.test/memo.mp3' });
    emit({ isLoaded: true, playing: true, currentTime: 1, duration: 30 });
    await loaded;
  });
  expect(playback.isPlaying).toBe(true);
  expect(playback.nowPlaying?.url).toBe('https://files.test/memo.mp3');
  mocks.player.pause.mockClear();
  mocks.player.replace.mockClear();

  await act(async () => playback.replace(null));

  expect(mocks.player.pause).toHaveBeenCalledOnce();
  expect(mocks.player.replace).toHaveBeenCalledWith({});
  expect(mocks.player.pause.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.player.replace.mock.invocationCallOrder[0]
  );
  expect(playback.nowPlaying).toBeNull();
  expect(playback.isPlaying).toBe(false);
  act(() => tree.unmount());
});

it('cancels a pending shared load when clearing the source for another player', async () => {
  const { playback, tree } = render();
  const loaded = playback.replace({ url: 'https://files.test/memo.mp3' });
  const result = loaded.catch((error: Error) => error.message);
  const settled = vi.fn();
  void result.then(settled);

  await act(async () => playback.replace(null));
  const settledWithoutNativeEvent = settled.mock.calls.length;
  await act(async () => {
    // A late status from the old native source cannot revive the request.
    emit({ isLoaded: true, playing: false, currentTime: 0, duration: 30 });
    expect(await result).toBe('Audio source replaced before loading completed');
  });

  expect(playback.nowPlaying).toBeNull();
  expect(mocks.player.play).not.toHaveBeenCalled();
  act(() => tree.unmount());
  expect(settledWithoutNativeEvent).toBe(1);
});

it.each(['mode', 'activate'] as const)(
  'does not resume the old native source after handoff during pending %s setup',
  async (stage) => {
    const { playback, tree } = render();
    await act(async () => {
      const loaded = playback.replace({ url: 'https://files.test/memo.mp3' });
      emit({ isLoaded: true, playing: false, currentTime: 0, duration: 30 });
      await loaded;
    });
    let finishSetup!: () => void;
    mocks[stage].mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSetup = resolve))
    );
    await act(async () => {
      playback.play();
    });
    await act(async () => {
      await playback.pause();
      await playback.replace(null);
      finishSetup();
    });
    // Android accepts the empty record but keeps its previous source paused.
    // A delayed play must not restart that source after Bucket takes over.
    expect(mocks.player.play).not.toHaveBeenCalled();
    expect(playback.nowPlaying).toBeNull();
    act(() => tree.unmount());
  }
);

it('does not activate playback when there is no shared source', async () => {
  const { playback, tree } = render();
  await act(async () => playback.play());
  expect(mocks.mode).not.toHaveBeenCalled();
  expect(mocks.activate).not.toHaveBeenCalled();
  expect(mocks.player.play).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it.each(['paused', 'playing', 'loading'] as const)(
  'reloads a %s memo on tap after a Bucket handoff without native reset events',
  async (state) => {
    const playing = state === 'playing';
    const url = 'https://files.test/memo.mp3';
    let playback!: NowPlayingValue;
    let controller!: ReturnType<typeof useNowPlayingController>;
    function Consumer() {
      const value = useNowPlaying();
      const memo = useNowPlayingController({ sourceUri: url });
      useLayoutEffect(() => {
        playback = value;
        controller = memo;
      });
      return null;
    }
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <NowPlayingProvider>
          <Consumer />
        </NowPlayingProvider>
      );
    });
    if (state === 'loading') {
      act(() => controller.togglePlayback());
      expect(controller.status).toBe('loading');
    } else {
      await act(async () => {
        const loaded = playback.replace({ url });
        emit({ isLoaded: true, playing, currentTime: 4, duration: 30 });
        await loaded;
        emit({ isLoaded: true, playing, currentTime: 4, duration: 30 });
      });
      expect(controller.isThisSourceLoaded).toBe(true);
      expect(controller.status).toBe(state);
    }

    // Bucket audio hands off in this order. On Android neither an already
    // paused player nor replace({}) has to emit a playback status update.
    await act(async () => {
      await playback.pause();
      await playback.replace(null);
    });
    expect(controller.isThisSourceLoaded).toBe(false);
    expect(controller.status).toBeNull();
    mocks.player.replace.mockClear();
    mocks.player.play.mockClear();

    act(() => controller.togglePlayback());
    expect(mocks.player.replace).toHaveBeenCalledWith(
      expect.objectContaining({ uri: url })
    );
    await act(async () => {
      emit({ isLoaded: true, playing: false, currentTime: 0, duration: 30 });
    });
    expect(mocks.player.play).toHaveBeenCalledOnce();
    act(() =>
      emit({ isLoaded: true, playing: true, currentTime: 1, duration: 30 })
    );
    expect(controller.status).toBe('playing');
    act(() => tree.unmount());
  }
);
