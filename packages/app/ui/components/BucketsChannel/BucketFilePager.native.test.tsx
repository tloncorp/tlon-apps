import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketFilePager } from './BucketFilePager.native';

type ScrollEndEvent = {
  nativeEvent: {
    contentOffset: { x: number };
    layoutMeasurement: { width: number };
  };
};
const scrollToIndex = vi.hoisted(() => vi.fn());
const carouselState = vi.hoisted(() => ({
  reducedMotion: false,
  onVisibleIndexChange: (_index: number) => {},
  onScrollBeginDrag: () => {},
  onMomentumScrollEnd: (_event: ScrollEndEvent) => {},
}));
vi.mock('react-native-reanimated', () => ({
  useReducedMotion: () => carouselState.reducedMotion,
}));
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
vi.mock('@tloncorp/ui', async () => {
  const { forwardRef, useEffect, useImperativeHandle } = await import('react');
  const Container = ({ children }: { children?: React.ReactNode }) => children;
  const Carousel = forwardRef(function TestCarousel(
    {
      children,
      onVisibleIndexChange,
      flatListProps,
    }: {
      children?: React.ReactNode;
      onVisibleIndexChange: (index: number) => void;
      flatListProps?: {
        onScrollBeginDrag?: () => void;
        onMomentumScrollEnd?: (event: ScrollEndEvent) => void;
      };
    },
    ref
  ) {
    useImperativeHandle(ref, () => ({ scrollToIndex }));
    useEffect(() => {
      carouselState.onVisibleIndexChange = onVisibleIndexChange;
      carouselState.onScrollBeginDrag =
        flatListProps?.onScrollBeginDrag ?? (() => {});
      carouselState.onMomentumScrollEnd =
        flatListProps?.onMomentumScrollEnd ?? (() => {});
    }, [onVisibleIndexChange, flatListProps]);
    return children;
  });
  const FilePreview = Object.assign(() => null, {
    fileExtensionFrom: () => 'MP3',
  });
  return {
    Carousel: Object.assign(Carousel, { Item: Container }),
    FilePreview,
    Text: () => null,
  };
});
vi.mock('tamagui', () => ({
  YStack: ({ children }: { children?: React.ReactNode }) => children,
}));
setupReactTestEnvironment();
beforeEach(() => {
  scrollToIndex.mockClear();
  carouselState.reducedMotion = false;
});

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

it('preserves the active player as siblings are added, reordered, removed, and reduced to one', () => {
  const mounted = vi.fn();
  const unmounted = vi.fn();
  scrollToIndex.mockClear();
  function Player() {
    useEffect(() => {
      mounted();
      return () => {
        unmounted();
      };
    }, []);
    return null;
  }
  const active = { id: 'audio', name: 'audio.mp3' };
  const before = { id: 'before', name: 'before.jpg' };
  const after = { id: 'after', name: 'after.pdf' };
  const element = (items: (typeof active)[]) => (
    <BucketFilePager
      navigation={{ items, index: items.indexOf(active), onSelect: vi.fn() }}
    >
      <Player />
    </BucketFilePager>
  );
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(element([active]));
  });
  for (const items of [
    [before, active],
    [after, before, active],
    [active, after, before],
    [active, after],
    [active],
  ]) {
    act(() => tree.update(element(items)));
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  }
  expect(scrollToIndex.mock.calls).toEqual([
    [1, false],
    [2, false],
    [0, false],
  ]);
  act(() => tree.unmount());
});

function renderNavigation() {
  const items = [0, 1, 2].map((index) => ({
    id: String(index),
    name: `${index}.jpg`,
  }));
  const onSelect = vi.fn();
  const element = (index: number) => (
    <BucketFilePager navigation={{ items, index, onSelect }}>
      <span>{items[index].name}</span>
    </BucketFilePager>
  );
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(element(0));
  });
  return {
    tree,
    onSelect,
    select: (index: number) => act(() => tree.update(element(index))),
  };
}

it('animates arrow selection without reselecting intermediate pages during rapid taps', () => {
  const { tree, onSelect, select } = renderNavigation();
  select(1);
  select(2);
  expect(scrollToIndex.mock.calls).toEqual([
    [1, true],
    [2, true],
  ]);
  act(() => carouselState.onVisibleIndexChange(1));
  expect(onSelect).not.toHaveBeenCalled();
  act(() =>
    carouselState.onMomentumScrollEnd({
      nativeEvent: {
        contentOffset: { x: 100 },
        layoutMeasurement: { width: 100 },
      },
    })
  ); // Finishing a superseded animation must not release the current target.
  act(() => carouselState.onVisibleIndexChange(1));
  expect(onSelect).not.toHaveBeenCalled();
  select(2); // A loading/cache update must not restart the scroll.
  expect(scrollToIndex).toHaveBeenCalledTimes(2);
  act(() => carouselState.onVisibleIndexChange(2));
  expect(onSelect).not.toHaveBeenCalled();
  act(() => carouselState.onVisibleIndexChange(1));
  expect(onSelect).toHaveBeenCalledWith(1);
  select(1); // A swipe already moved the carousel.
  expect(scrollToIndex).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});

it('cancels an in-flight forward move when the previous arrow is pressed', () => {
  const { tree, onSelect, select } = renderNavigation();
  select(1);
  select(0);
  expect(scrollToIndex.mock.calls).toEqual([
    [1, true],
    [0, true],
  ]);
  // The reversal can end before the rounded visible index ever changes.
  act(() =>
    carouselState.onMomentumScrollEnd({
      nativeEvent: {
        contentOffset: { x: 0 },
        layoutMeasurement: { width: 100 },
      },
    })
  );
  expect(onSelect).not.toHaveBeenCalled();
  act(() => carouselState.onVisibleIndexChange(1));
  expect(onSelect).toHaveBeenCalledWith(1);
  act(() => tree.unmount());
});

it('lets a manual drag take over an arrow transition', () => {
  const { tree, onSelect, select } = renderNavigation();
  select(2);
  act(() => carouselState.onVisibleIndexChange(1));
  expect(onSelect).not.toHaveBeenCalled();
  act(() => carouselState.onScrollBeginDrag());
  expect(onSelect).toHaveBeenCalledWith(1);
  select(1);
  expect(scrollToIndex).toHaveBeenCalledTimes(1);
  act(() => carouselState.onVisibleIndexChange(0));
  expect(onSelect).toHaveBeenLastCalledWith(0);
  act(() => tree.unmount());
});

it('changes documents without animation when Reduce Motion is enabled', () => {
  carouselState.reducedMotion = true;
  const { tree, select } = renderNavigation();
  select(1);
  expect(scrollToIndex).toHaveBeenCalledWith(1, false);
  act(() => tree.unmount());
});
