import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketFilePager } from './BucketFilePager.native';

vi.mock('@tloncorp/shared', async () => {
  const { useRef } = await import('react');
  return {
    useMutableRef: (value: unknown) => {
      const ref = useRef(value);
      ref.current = value;
      return ref;
    },
  };
});
vi.mock('@tloncorp/ui', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => children;
  const FilePreview = Object.assign(() => null, {
    fileExtensionFrom: () => 'MP3',
  });
  return {
    Carousel: Object.assign(Container, { Item: Container }),
    FilePreview,
    Text: () => null,
  };
});
vi.mock('tamagui', () => ({
  YStack: ({ children }: { children?: React.ReactNode }) => children,
}));
setupReactTestEnvironment();

it.each(['image', 'pdf', 'text'])(
  'keeps a visited %s mounted across swipes but releases an audio page',
  (kind) => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function Page({ id }: { id: string }) {
      useEffect(() => {
        mounted(id);
        return () => {
          unmounted(id);
        };
      }, [id]);
      return null;
    }
    const items = [
      {
        id: 'photo',
        name: `file.${kind}`,
        uri: `https://files.test/file.${kind}`,
      },
      { id: 'audio', name: 'audio.mp3', uri: 'https://files.test/audio.mp3' },
    ];
    const element = (index: number, expired = false) => (
      <BucketFilePager
        navigation={{
          index,
          items: expired
            ? items.map((item) => ({ ...item, uri: undefined }))
            : items,
          onSelect: vi.fn(),
        }}
        retainActivePage={index === 0}
      >
        <Page key={items[index].id} id={items[index].id} />
      </BucketFilePager>
    );
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(element(0));
    });
    act(() => tree.update(element(1)));
    expect(unmounted).not.toHaveBeenCalled();
    act(() => tree.update(element(0)));
    expect(mounted.mock.calls.filter(([id]) => id === 'photo')).toHaveLength(1);
    expect(unmounted).toHaveBeenCalledWith('audio');
    act(() => tree.update(element(1, true)));
    expect(unmounted).toHaveBeenCalledWith('photo');
  }
);
