import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAnchorScrollLock } from './useAnchorScrollLock';
vi.mock('@tloncorp/shared', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    createDevLogger: () => ({ log: () => {}, error: () => {} }),
    useMutableCallback: (fn: (...args: any[]) => any) => {
      const ref = React.useRef(fn);
      ref.current = fn;
      return React.useCallback((...args: any[]) => ref.current(...args), []);
    },
  };
});
let renderer: ReactTestRenderer | undefined;
let hook: ReturnType<typeof useAnchorScrollLock>;
const post = { id: 'selected' } as any;
const scrollToIndex = vi.fn();
const scrollToOffset = vi.fn();
function Harness() {
  const ref = React.useRef({ scrollToIndex, scrollToOffset } as any);
  hook = useAnchorScrollLock({
    flatListRef: ref,
    posts: [post],
    anchor: { postId: post.id },
    columnsCount: 1,
  });
  return null;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  scrollToIndex.mockReset();
  scrollToOffset.mockReset();
  act(() => {
    renderer = create(<Harness />);
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.useRealTimers();
});
const failure = {
  index: 0,
  highestMeasuredFrameIndex: 0,
  averageItemLength: 80,
};
it('cancels a queued selected-anchor retry synchronously on imperative takeover', () => {
  scrollToIndex.mockImplementationOnce(() =>
    hook.flatlistProps.onScrollToIndexFailed(failure)
  );
  act(() => hook.scrollerItemProps.onLayout(post, 0));
  expect(scrollToIndex).toHaveBeenCalledTimes(1);
  expect(scrollToOffset).toHaveBeenCalledTimes(1);
  act(() => {
    hook.cancelPendingAnchorScroll();
    // A synchronous failure callback can arrive before React has rerendered.
    hook.flatlistProps.onScrollToIndexFailed(failure);
    vi.advanceTimersByTime(1000);
  });
  expect(scrollToIndex).toHaveBeenCalledTimes(1);
  expect(scrollToOffset).toHaveBeenCalledTimes(1);
  expect(hook.readyToDisplayPosts).toBe(true);
});
it('uses the same synchronous cancellation path for actual drag', () => {
  act(() => hook.flatlistProps.onScrollToIndexFailed(failure));
  act(() => {
    hook.flatlistProps.onScrollBeginDrag();
    vi.advanceTimersByTime(1000);
  });
  expect(scrollToIndex).not.toHaveBeenCalled();
  expect(hook.readyToDisplayPosts).toBe(true);
});
