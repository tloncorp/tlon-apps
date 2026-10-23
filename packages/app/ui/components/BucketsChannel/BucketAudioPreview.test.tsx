import { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { useBucketPreview } from '../../../features/buckets/useBucketPreview';
import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketAudioPreview } from './BucketAudioPreview';

vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));
vi.mock('../../../ui', () => ({ canPreviewFromText: () => false }));
vi.mock('@tloncorp/ui', () => ({
  FilePreview: Object.assign(() => null, { fileExtensionFrom: () => 'MP3' }),
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({ YStack: 'YStack' }));
setupReactTestEnvironment();

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
