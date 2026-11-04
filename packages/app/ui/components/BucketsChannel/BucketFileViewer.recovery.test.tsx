import { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBucketPreview } from '../../../features/buckets/useBucketPreview';
import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketFileViewer as WebViewer } from './BucketFileViewer';
import { BucketFileViewer as NativeViewer } from './BucketFileViewer.native';

const mocks = vi.hoisted(() => ({
  initialStatus: 'readyToPlay',
  players: [] as {
    uri: string;
    status: string;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    listeners: Set<(event: { status: string }) => void>;
  }[],
}));
vi.mock('expo-video', async () => {
  const { useState } = await import('react');
  return {
    VideoView: 'VideoView',
    useVideoPlayer: (
      source: { uri: string },
      setup: (player: (typeof mocks.players)[number]) => void
    ) => {
      const [player] = useState(() => {
        const listeners = new Set<(event: { status: string }) => void>();
        const instance = {
          uri: source.uri,
          status: mocks.initialStatus,
          play: vi.fn(),
          pause: vi.fn(),
          listeners,
          addListener: (
            _name: string,
            listener: (event: { status: string }) => void
          ) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
          },
        };
        mocks.players.push(instance);
        setup(instance);
        return instance;
      });
      return player;
    },
  };
});
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { openURL: vi.fn() },
}));
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));
vi.mock('../../../hooks/useWebview', () => ({ useWebView: () => ({}) }));
vi.mock('../../../ui', () => ({ canPreviewFromText: () => false }));
vi.mock('@tloncorp/ui', () => ({
  FilePreview: Object.assign(() => null, { fileExtensionFrom: () => 'MP4' }),
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  View: 'View',
  YStack: 'YStack',
  Spinner: 'Spinner',
  ScrollView: 'ScrollView',
}));
vi.mock('../ScreenHeader', () => ({ ScreenHeader: () => null }));
vi.mock('./BucketPreviewControls', () => ({
  BucketPreviewControls: () => null,
}));
vi.mock('./BucketPreviewOpenButton', () => ({
  BucketPreviewOpenButton: () => null,
}));
vi.mock('./BucketPreviewImage', () => ({ BucketPreviewImage: () => null }));
vi.mock('./BucketAudioPreview', () => ({ BucketAudioPreview: () => null }));
vi.mock('./BucketPreviewContent', () => ({
  BucketPreviewContent: ({ children }: { children: React.ReactNode }) =>
    children,
}));

setupReactTestEnvironment();
beforeEach(() => {
  mocks.players.length = 0;
  mocks.initialStatus = 'readyToPlay';
});

const video = {
  id: '1',
  kind: 'file' as const,
  name: 'clip.mp4',
  mimeType: 'video/mp4',
  author: '~zod',
  modifiedLabel: 'Just now',
};
const otherFile = {
  ...video,
  id: '2',
  name: 'other.zip',
  mimeType: 'application/zip',
};

describe.each([
  ['web', WebViewer],
  ['native', NativeViewer],
] as const)('%s video grant recovery', (platform, Viewer) => {
  it.each(['Retry', 'return navigation'])(
    'evicts rejected grants and recovers through %s',
    async (recovery) => {
      let version = 0;
      const readGrant = vi.fn(async (id: number) => ({
        readUrl: `https://files.test/${id}/${++version}.mp4`,
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      }));
      let preview!: ReturnType<typeof useBucketPreview>;
      function Harness() {
        const current = useBucketPreview(readGrant, '~zod/files');
        useLayoutEffect(() => {
          preview = current;
        });
        const item = current.item;
        return item ? (
          <Viewer
            item={{ ...item, uri: item.previewUri }}
            loading={current.loading}
            onClose={current.close}
            onPreviewError={() => current.invalidate(item)}
            onRetry={() => void current.load(item, { refresh: true })}
          />
        ) : null;
      }
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<Harness />);
      });
      await act(async () => preview.load(video));
      const rejectedUri = preview.item!.previewUri;
      act(() => {
        if (platform === 'web') tree.root.findByType('video').props.onError();
        else {
          const player = mocks.players.at(-1)!;
          player.status = 'error';
          for (const listener of player.listeners)
            listener({ status: 'error' });
        }
      });
      expect(preview.getCached(video)).toBeUndefined();
      expect(JSON.stringify(tree.toJSON())).toContain(
        'Couldn’t load this file'
      );
      if (recovery === 'Retry') {
        await act(async () =>
          tree.root
            .findByProps({ accessibilityLabel: 'Retry file' })
            .props.onPress()
        );
      } else {
        await act(async () => preview.load(otherFile));
        await act(async () => preview.load(video));
      }
      expect(readGrant.mock.calls.filter(([id]) => id === 1)).toHaveLength(2);
      expect(preview.item!.previewUri).not.toBe(rejectedUri);
      expect(JSON.stringify(tree.toJSON())).not.toContain(
        'Couldn’t load this file'
      );
      if (platform === 'web') {
        expect(tree.root.findByType('video').props.src).toBe(
          preview.item!.previewUri
        );
      } else {
        expect(mocks.players.at(-1)!.uri).toBe(preview.item!.previewUri);
        expect(mocks.players.at(-1)!.play).toHaveBeenCalledOnce();
        expect(mocks.players[0].listeners.size).toBe(0);
      }
      act(() => tree.unmount());
      if (platform === 'native')
        expect(mocks.players.at(-1)!.listeners.size).toBe(0);
    }
  );
});

it('handles a native source already in error and resets failure when its URI changes', () => {
  mocks.initialStatus = 'error';
  const onError = vi.fn();
  const onRetry = vi.fn();
  const element = (uri: string) => (
    <NativeViewer
      item={{ ...video, uri }}
      onClose={vi.fn()}
      onPreviewError={onError}
      onRetry={onRetry}
    />
  );
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(element('https://files.test/failed.mp4'));
  });
  expect(onError).toHaveBeenCalledOnce();
  act(() =>
    tree.root.findByProps({ accessibilityLabel: 'Retry file' }).props.onPress()
  );
  expect(onRetry).toHaveBeenCalledOnce();
  mocks.initialStatus = 'readyToPlay';
  act(() => tree.update(element('https://files.test/fresh.mp4')));
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    'Couldn’t load this file'
  );
  expect(mocks.players.at(-1)!.uri).toBe('https://files.test/fresh.mp4');
  expect(onError).toHaveBeenCalledOnce();
  act(() => tree.unmount());
});

it('reloads a retained PDF with a fresh grant and discards the previous iframe', async () => {
  const pdf = { ...video, name: 'guide.pdf', mimeType: 'application/pdf' };
  const files = [pdf, otherFile];
  const expiresAt = new Date(Date.now() + 300000).toISOString();
  let renewed!: (grant: { readUrl: string; expiresAt: string }) => void;
  let pdfRequests = 0;
  const readGrant = vi.fn(async (id: number) => {
    if (id === 1 && ++pdfRequests === 2) {
      return new Promise<{ readUrl: string; expiresAt: string }>((resolve) => {
        renewed = resolve;
      });
    }
    return { readUrl: `https://files.test/${id}/original`, expiresAt };
  });
  let preview!: ReturnType<typeof useBucketPreview>;
  function Harness() {
    const current = useBucketPreview(readGrant, '~zod/files');
    useLayoutEffect(() => {
      preview = current;
    });
    const item = current.item;
    return item ? (
      <WebViewer
        item={{ ...item, uri: item.previewUri }}
        loading={current.loading}
        onClose={current.close}
        onRetry={() => void current.load(item, { refresh: true })}
        navigation={{
          items: files.map((file) => ({
            ...file,
            uri: current.getCached(file)?.previewUri,
          })),
          index: files.findIndex((file) => file.id === item.id),
          onSelect: (index) => void current.load(files[index]),
        }}
      />
    ) : null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Harness />);
  });
  await act(async () => preview.load(pdf));
  const previousFrame = tree.root.findByType('iframe');
  await act(async () => preview.load(otherFile));
  await act(async () => preview.load(pdf));
  expect(tree.root.findByType('iframe')).toBe(previousFrame);
  expect(pdfRequests).toBe(1);
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Reload preview' })
      .props.onPress()
  );
  expect(pdfRequests).toBe(2);
  expect(preview.getCached(pdf)).toBeUndefined();
  expect(tree.root.findAllByType('iframe')).toHaveLength(0);
  await act(async () =>
    renewed({ readUrl: 'https://files.test/1/fresh.pdf', expiresAt })
  );
  expect(tree.root.findByType('iframe')).not.toBe(previousFrame);
  expect(tree.root.findByType('iframe').props.src).toBe(
    'https://files.test/1/fresh.pdf'
  );
  expect(preview.getCached(pdf)?.previewUri).toBe(
    'https://files.test/1/fresh.pdf'
  );
  act(() => tree.unmount());
});
