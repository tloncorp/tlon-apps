import React, { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { PostList } from './PostListFlatList';
import type { PostListMethods } from './shared';
const mock = vi.hoisted(() => ({
  props: null as any,
  cancel: vi.fn(),
  end: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('react-native-reanimated', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: {
      FlatList: React.forwardRef((props: any, ref) => {
        mock.props = props;
        React.useImperativeHandle(ref, () => ({ scrollToEnd: mock.end }));
        return null;
      }),
    },
  };
});
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock('../../../contexts/scroll', () => ({
  useConversationScrollViewNativeID: () => 'flat-list',
  useScrollDirectionTracker: () => ({ onScroll: () => {}, isAtBottom: true }),
}));
vi.mock('../useAnchorScrollLock', () => ({
  useAnchorScrollLock: () => ({
    readyToDisplayPosts: true,
    cancelPendingAnchorScroll: mock.cancel,
    scrollerItemProps: {},
    flatlistProps: {},
  }),
}));
let renderer: ReactTestRenderer | undefined;
const ref = createRef<PostListMethods>();
async function render(channel: string, isFocused = true) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => {
    const element = (
      <PostList
        ref={ref}
        isFocused={isFocused}
        channel={{ id: channel } as any}
        anchor={null}
        numColumns={1}
        collectionLayoutType={'compact-list' as any}
        postsWithNeighbors={[]}
        renderItem={() => null}
        onScrollIntentChanged={mock.notify}
      />
    );
    if (renderer) renderer.update(element);
    else renderer = create(element);
  });
}
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.clearAllMocks();
});
it('exposes a permit revoked by native drag and explicit navigation', async () => {
  await render('a');
  const first = ref.current!.captureScrollIntent!();
  act(() => mock.props.onScrollBeginDrag());
  expect(first()).toBe(false);
  const second = ref.current!.captureScrollIntent!();
  act(() => ref.current!.scrollToEnd({}));
  expect(second()).toBe(false);
  expect(mock.cancel).toHaveBeenCalledTimes(2);
  expect(mock.notify).toHaveBeenCalledTimes(2);
  expect(mock.end).toHaveBeenCalledTimes(1);
});
it('revokes permits and captured imperative handles through channel ABA', async () => {
  await render('a');
  const first = ref.current!;
  const permit = first.captureScrollIntent!();
  await render('b');
  await render('a');
  expect(permit()).toBe(false);
  act(() => first.scrollToEnd({}));
  expect(mock.end).not.toHaveBeenCalled();
});

it('retains its list but cancels anchor and old intent across route cover and return', async () => {
  await render('a');
  const permit = ref.current!.captureScrollIntent!();
  await render('a', false);
  expect(permit()).toBe(false);
  expect(mock.cancel).toHaveBeenCalledTimes(1);
  act(() => ref.current!.scrollToEnd({}));
  expect(mock.end).not.toHaveBeenCalled();
  await render('a', true);
  expect(permit()).toBe(false);
  expect(mock.end).not.toHaveBeenCalled();
  act(() => ref.current!.scrollToEnd({}));
  expect(mock.end).toHaveBeenCalledTimes(1);
});
