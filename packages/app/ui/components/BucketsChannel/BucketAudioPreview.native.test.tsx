import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketAudioPreview } from './BucketAudioPreview.native';

const mocks = vi.hoisted(() => ({
  mode: vi.fn(() => Promise.resolve()),
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
    error: null,
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
}));

setupReactTestEnvironment();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mode.mockResolvedValue(undefined);
  mocks.status.currentTime = 0;
  mocks.status.didJustFinish = false;
  mocks.status.playing = false;
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
  it('does not start playback after leaving a file while audio mode setup is pending', async () => {
    let ready!: () => void;
    mocks.mode.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve;
        })
    );
    const tree = render();
    act(() =>
      tree.root.findByProps({ testID: 'BucketAudioPlayPause' }).props.onPress()
    );
    act(() => tree.unmount());
    await act(async () => {
      ready();
    });
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
