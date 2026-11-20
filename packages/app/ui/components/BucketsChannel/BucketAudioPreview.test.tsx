import { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { useBucketPreview } from '../../../features/buckets/useBucketPreview';
import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import {
  NowPlayingProvider,
  NowPlayingValue,
  useNowPlaying,
  useNowPlayingController,
} from '../../contexts/nowPlaying';
import { BucketAudioPreview } from './BucketAudioPreview';

const shared = vi.hoisted(() => {
  const listeners = new Set<(status: Record<string, unknown>) => void>();
  return {
    listeners,
    player: {
      pause: vi.fn(),
      play: vi.fn(),
      replace: vi.fn(),
      addListener: (
        _name: string,
        listener: (status: Record<string, unknown>) => void
      ) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
  };
});
vi.mock('expo-audio', () => ({
  useAudioPlayer: () => shared.player,
  setAudioModeAsync: vi.fn().mockResolvedValue(undefined),
  setIsAudioActiveAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: vi.fn() }));
vi.mock('@tloncorp/shared', () => import('@tloncorp/shared/logic/utilHooks'));
vi.mock('../../../hooks/useAppStatusChange', () => ({
  useAppStatusChange: vi.fn(),
}));
vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));
vi.mock('../../../ui', () => ({ canPreviewFromText: () => false }));
vi.mock('@tloncorp/ui', () => ({
  FilePreview: Object.assign(() => null, { fileExtensionFrom: () => 'MP3' }),
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({ YStack: 'YStack' }));
setupReactTestEnvironment();
beforeEach(() => {
  vi.clearAllMocks();
  shared.listeners.clear();
});

it.each(['loading', 'playing'] as const)(
  'stops a %s memo when web Bucket audio starts, including a late load completion',
  async (state) => {
    let playback!: NowPlayingValue;
    let memo!: ReturnType<typeof useNowPlayingController>;
    function Harness() {
      const value = useNowPlaying();
      const controller = useNowPlayingController({
        sourceUri: 'https://files.test/memo.mp3',
      });
      useLayoutEffect(() => {
        playback = value;
        memo = controller;
      });
      return (
        <BucketAudioPreview
          item={{ name: 'Bucket.mp3', uri: 'https://files.test/bucket.mp3' }}
        />
      );
    }
    const emit = (playing: boolean) => {
      for (const listener of shared.listeners) {
        listener({ isLoaded: true, playing, currentTime: 1, duration: 60 });
      }
    };
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <NowPlayingProvider>
          <Harness />
        </NowPlayingProvider>
      );
    });
    try {
      await act(async () => memo.togglePlayback());
      if (state === 'playing') {
        await act(async () => emit(false));
        act(() => emit(true));
      }
      shared.player.play.mockClear();
      shared.player.pause.mockClear();
      await act(async () => tree.root.findByType('audio').props.onPlay?.());
      // The old source may finish after the user starts Bucket playback.
      await act(async () => emit(false));
      expect(playback.nowPlaying).toBeNull();
      expect(shared.player.pause).toHaveBeenCalled();
      expect(shared.player.play).not.toHaveBeenCalled();
      expect(memo.status).toBeNull();
    } finally {
      act(() => tree.unmount());
      error.mockRestore();
    }
  }
);

it('evicts a failed audio link and retries with a fresh grant and working controls', async () => {
  const file = {
    id: '1',
    kind: 'file' as const,
    name: 'memo.mp3',
    mimeType: 'audio/mpeg',
    author: '~zod',
    modifiedLabel: 'Just now',
  };
  const expiresAt = new Date(Date.now() + 300000).toISOString();
  const readGrant = vi
    .fn()
    .mockResolvedValueOnce({
      readUrl: 'https://files.test/stale.mp3',
      expiresAt,
    })
    .mockResolvedValue({ readUrl: 'https://files.test/fresh.mp3', expiresAt });
  const pause = vi.fn();
  let preview!: ReturnType<typeof useBucketPreview>;
  function Harness() {
    const current = useBucketPreview(readGrant, '~zod/files');
    useLayoutEffect(() => {
      preview = current;
    });
    const item = current.item;
    return item?.previewUri && !current.loading ? (
      <BucketAudioPreview
        key={item.previewUri}
        item={{ name: item.name, uri: item.previewUri }}
        onError={() => current.invalidate(item)}
        onRetry={() => void current.load(file, { refresh: true })}
      />
    ) : null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Harness />, {
      createNodeMock: (element) =>
        element.type === 'audio' ? { pause } : null,
    });
  });
  await act(async () => preview.load(file));
  expect(tree.root.findByType('audio').props.src).toBe(
    'https://files.test/stale.mp3'
  );
  act(() => tree.root.findByType('audio').props.onError());
  expect(pause).toHaveBeenCalled();
  expect(preview.getCached(file)).toBeUndefined();
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Retry audio' }).props.onPress()
  );
  expect(readGrant).toHaveBeenCalledTimes(2);
  expect(tree.root.findByType('audio').props.src).toBe(
    'https://files.test/fresh.mp3'
  );
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Retry audio' })
  ).toHaveLength(0);
  act(() => tree.unmount());
});
