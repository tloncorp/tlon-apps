import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketAudioPreview } from './BucketAudioPreview.native';

const mocks = vi.hoisted(() => ({
  sharedPlayback: {
    pause: vi.fn(() => Promise.resolve()),
    replace: vi.fn((_source: null) => Promise.resolve()),
  },
  hasProvider: true,
  mode: vi.fn(() => Promise.resolve()),
  activate: vi.fn((_active: boolean) => Promise.resolve()),
  player: {
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(() => Promise.resolve()),
  },
  status: {
    isLoaded: true,
    isBuffering: false,
    playing: false,
    duration: 30,
    currentTime: 0,
    didJustFinish: false,
    error: null as string | null,
  },
  appState: vi.fn(),
  navigationEvents: new Map<string, () => void>(),
}));
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return {
    NavigationContext: createContext({
      addListener: (name: string, listener: () => void) => {
        mocks.navigationEvents.set(name, listener);
        return () => mocks.navigationEvents.delete(name);
      },
      isFocused: () => true,
    }),
  };
});
vi.mock('@tloncorp/api/lib/utils', () => ({ makePrettyTimeFromMs: String }));
vi.mock('@tloncorp/ui', () => ({
  FilePreview: Object.assign(() => null, { fileExtensionFrom: () => 'mp3' }),
  Icon: 'Icon',
  IconButton: 'IconButton',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  Spinner: 'Spinner',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_name: string, callback: unknown) => {
      mocks.appState.mockImplementation(callback as never);
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('expo-audio', () => ({
  useAudioPlayer: () => mocks.player,
  useAudioPlayerStatus: () => mocks.status,
  setAudioModeAsync: mocks.mode,
  setIsAudioActiveAsync: mocks.activate,
}));
vi.mock('../../contexts/nowPlaying', () => ({
  useOptionalNowPlaying: () =>
    mocks.hasProvider ? mocks.sharedPlayback : null,
}));

setupReactTestEnvironment();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mode.mockResolvedValue(undefined);
  mocks.activate.mockResolvedValue(undefined);
  mocks.sharedPlayback.pause.mockResolvedValue(undefined);
  mocks.sharedPlayback.replace.mockResolvedValue(undefined);
  mocks.player.seekTo.mockResolvedValue(undefined);
  mocks.hasProvider = true;
  mocks.status.currentTime = 0;
  mocks.status.didJustFinish = false;
  mocks.status.playing = false;
  mocks.status.error = null;
});
function render() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <BucketAudioPreview
        item={{ id: '1', name: 'test.mp3', uri: 'https://files.test/test.mp3' }}
      />
    );
  });
  return tree;
}

describe('Bucket audio playback lifecycle', () => {
  it('reactivates audio before playing after a background and foreground cycle', async () => {
    const tree = render();
    act(() => mocks.appState('background'));
    act(() => mocks.appState('active'));
    let activated!: () => void;
    mocks.activate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          activated = resolve;
        })
    );
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    expect(mocks.activate).toHaveBeenCalledWith(true);
    expect(mocks.player.play).not.toHaveBeenCalled();
    await act(async () => activated());
    expect(mocks.player.play).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it.each(['unmount', 'blur', 'background'])(
    'does not seek or play after %s while audio activation is pending',
    async (leave) => {
      mocks.status.didJustFinish = true;
      let activated!: () => void;
      mocks.activate.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            activated = resolve;
          })
      );
      const tree = render();
      await act(async () =>
        tree.root
          .findByProps({ testID: 'BucketAudioPlayPause' })
          .props.onPress()
      );
      expect(mocks.activate).toHaveBeenCalledWith(true);
      act(() => {
        if (leave === 'unmount') tree.unmount();
        else if (leave === 'blur') mocks.navigationEvents.get('blur')?.();
        else mocks.appState('background');
      });
      await act(async () => activated());
      expect(mocks.player.seekTo).not.toHaveBeenCalled();
      expect(mocks.player.play).not.toHaveBeenCalled();
      if (leave !== 'unmount') act(() => tree.unmount());
    }
  );

  it('does not start playback after leaving a file while audio mode setup is pending', async () => {
    let ready!: () => void;
    mocks.mode.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve;
        })
    );
    const tree = render();
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    act(() => tree.unmount());
    await act(async () => {
      ready();
    });
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.player.play).not.toHaveBeenCalled();
  });
  it('pauses when the screen loses focus or the app goes into the background', () => {
    const tree = render();
    act(() => mocks.navigationEvents.get('blur')?.());
    expect(mocks.player.pause).toHaveBeenCalledTimes(1);
    act(() => mocks.appState('background'));
    expect(mocks.player.pause).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });
  it('replays from the beginning after reaching the end', async () => {
    mocks.status.currentTime = 30;
    mocks.status.didJustFinish = true;
    const tree = render();
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    expect(mocks.player.seekTo).toHaveBeenCalledWith(0);
    expect(mocks.player.play).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});

describe('Bucket audio coordination and recovery', () => {
  it('waits for shared playback to stop before reactivating audio and playing', async () => {
    let paused!: () => void;
    mocks.sharedPlayback.pause.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          paused = resolve;
        })
    );
    const tree = render();
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    expect(mocks.sharedPlayback.pause).toHaveBeenCalledTimes(1);
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.player.play).not.toHaveBeenCalled();
    await act(async () => paused());
    expect(mocks.sharedPlayback.replace).toHaveBeenCalledWith(null);
    expect(
      mocks.sharedPlayback.replace.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.activate.mock.invocationCallOrder[0]);
    expect(mocks.activate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.player.play.mock.invocationCallOrder[0]
    );
    act(() => tree.unmount());
  });

  it('does not activate or play after leaving while shared playback is stopping', async () => {
    let paused!: () => void;
    mocks.sharedPlayback.pause.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          paused = resolve;
        })
    );
    const tree = render();
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    act(() => tree.unmount());
    await act(async () => paused());
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.player.play).not.toHaveBeenCalled();
  });

  it('supports standalone previews without the shared playback provider', async () => {
    mocks.hasProvider = false;
    const tree = render();
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    expect(mocks.player.play).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('keeps Pause and seek retry available after a failed seek during playback', async () => {
    mocks.status.playing = true;
    mocks.player.seekTo.mockRejectedValueOnce(new Error('Seek failed'));
    const tree = render();
    await act(async () =>
      tree.root
        .findByProps({ accessibilityLabel: 'Forward 15 seconds' })
        .props.onPress()
    );
    expect(JSON.stringify(tree.toJSON())).toContain(
      'Couldn’t seek in this audio. Try again.'
    );
    expect(
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props
        .accessibilityLabel
    ).toBe('Pause audio');
    await act(async () =>
      tree.root
        .findByProps({ accessibilityLabel: 'Forward 15 seconds' })
        .props.onPress()
    );
    expect(mocks.player.seekTo).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).not.toContain('Couldn’t seek');
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    expect(mocks.player.pause).toHaveBeenCalledTimes(1);
    expect(mocks.sharedPlayback.pause).not.toHaveBeenCalled();
    expect(mocks.activate).toHaveBeenCalledWith(false);
    expect(mocks.player.pause.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.activate.mock.invocationCallOrder[0]
    );
    act(() => tree.unmount());
  });
});

it('cancels pending playback across a background/foreground round trip', async () => {
  let activated!: () => void;
  mocks.activate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        activated = resolve;
      })
  );
  const tree = render();
  await act(async () =>
    tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
  );
  act(() => mocks.appState('background'));
  act(() => mocks.appState('active'));
  await act(async () => activated());
  expect(mocks.player.play).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
  );
  expect(mocks.player.play).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it.each(['blur', 'background', 'unmount'])(
  'releases its audio session on %s after playback starts',
  async (event) => {
    const tree = render();
    await act(async () =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    expect(mocks.activate).toHaveBeenCalledWith(true);
    mocks.activate.mockClear();
    await act(async () => {
      if (event === 'unmount') tree.unmount();
      else if (event === 'blur') mocks.navigationEvents.get('blur')?.();
      else mocks.appState('background');
    });
    expect(mocks.activate).toHaveBeenCalledTimes(1);
    expect(mocks.activate).toHaveBeenCalledWith(false);
    if (event !== 'unmount') act(() => tree.unmount());
  }
);

it('does not deactivate another player when leaving an audio preview that never played', () => {
  const tree = render();
  act(() => mocks.navigationEvents.get('blur')?.());
  act(() => tree.unmount());
  expect(mocks.activate).not.toHaveBeenCalled();
});

it('releases audio focus when playback finishes', async () => {
  const tree = render();
  await act(async () =>
    tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
  );
  mocks.activate.mockClear();
  mocks.status.didJustFinish = true;
  await act(async () =>
    tree.update(
      <BucketAudioPreview
        item={{ id: '1', name: 'test.mp3', uri: 'https://files.test/test.mp3' }}
      />
    )
  );
  expect(mocks.activate).toHaveBeenCalledTimes(1);
  expect(mocks.activate).toHaveBeenCalledWith(false);
  act(() => tree.unmount());
});

it('invalidates a failed native audio source and exposes retry', () => {
  mocks.status.error = 'HTTP 403';
  const onError = vi.fn();
  const onRetry = vi.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <BucketAudioPreview
        item={{ name: 'memo.mp3', uri: 'https://files.test/memo.mp3' }}
        onError={onError}
        onRetry={onRetry}
      />
    );
  });
  expect(onError).toHaveBeenCalledOnce();
  mocks.status.error = null;
  act(() =>
    tree.update(
      <BucketAudioPreview
        item={{ name: 'memo.mp3', uri: 'https://files.test/memo.mp3' }}
        onError={onError}
        onRetry={onRetry}
      />
    )
  );
  expect(onError).toHaveBeenCalledOnce();
  act(() =>
    tree.root.findByProps({ accessibilityLabel: 'Retry audio' }).props.onPress()
  );
  expect(onRetry).toHaveBeenCalledOnce();
  act(() => tree.unmount());
});

it('keeps playback and audio focus through an inactive/active transition', async () => {
  const tree = render();
  await act(async () =>
    tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
  );
  mocks.player.pause.mockClear();
  mocks.activate.mockClear();
  act(() => mocks.appState('inactive'));
  act(() => mocks.appState('active'));
  expect(mocks.player.pause).not.toHaveBeenCalled();
  expect(mocks.activate).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
