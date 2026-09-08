// @vitest-environment jsdom
import React, { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLifecyclePermit } from '../../../../hooks/useLifecyclePermit';
import { ConversationScrollToBottomButton } from '../../conversationScrollChrome';
import { useScrollerLatest } from '../useScrollerLatest';
import { PostList } from './PostList.web';
import type { PostListMethods } from './shared';

vi.mock('@react-navigation/elements', () => ({
  HeaderHeightContext: React.createContext(0),
}));
vi.mock('../../../contexts/scroll', () => ({
  useConversationScrollEndAnchor: () => null,
}));
vi.mock('../../../../navigation/nativeHeaderOptions', () => ({
  supportsNativeScrollEdgeChrome: () => false,
}));
vi.mock('../../GlassSurface', () => ({ supportsLiquidGlass: () => false }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@tloncorp/shared', () => ({
  useMutableCallback: (callback: unknown) => callback,
}));
vi.mock('./PostListFlatList', () => ({ PostList: 'unused-grid' }));
vi.mock('react-native', () => ({
  Platform: { OS: 'web', Version: 0 },
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: 'unused-pressable',
}));
vi.mock('@tloncorp/ui', () => ({
  // Toolkit host and CSS layout are modeled. The actual web list, geometry
  // callback, Latest request owner and animated interaction gate run unchanged.
  FloatingActionButton: ({
    onPress,
    icon,
  }: {
    onPress: () => void;
    icon: React.ReactNode;
  }) => <button onClick={onPress}>{icon}</button>,
  Icon: () => <span>Latest</span>,
  LoadingSpinner: () => <span>Loading</span>,
}));
vi.mock('react-native-reanimated', () => ({
  default: {
    View: ({
      children,
      testID,
      pointerEvents,
      style,
    }: React.PropsWithChildren<{
      testID: string;
      pointerEvents: string;
      style: () => React.CSSProperties;
    }>) => (
      <div
        data-testid={testID}
        style={{
          ...style(),
          transform: undefined,
          pointerEvents: pointerEvents as React.CSSProperties['pointerEvents'],
        }}
      >
        {children}
      </div>
    ),
  },
  Easing: { cubic: 0, in: () => 0, out: () => 0 },
  useReducedMotion: () => false,
  useSharedValue: (value: number) => {
    const [, render] = React.useReducer((n: number) => n + 1, 0);
    const shared = React.useRef<{ value: number } | null>(null);
    if (!shared.current) {
      let current = value;
      shared.current = {
        get value() {
          return current;
        },
        set value(next: number) {
          if (next !== current) {
            current = next;
            render();
          }
        },
      };
    }
    return shared.current;
  },
  useAnimatedStyle: (worklet: () => unknown) => worklet,
  withTiming: (target: number) => target,
}));
let host: HTMLDivElement, root: Root;
let viewport = 699,
  extent = 1098;
let frames: Map<number, FrameRequestCallback>, nextFrame: number;
const list = createRef<PostListMethods>();
const entry = { active: true };
const onEndReached = vi.fn();
function Harness({ focused = true }: { focused?: boolean }) {
  const scrollVisit = useLifecyclePermit(['chat/~zod/latest'], focused);
  const latest = useScrollerLatest({
    scrollVisit,
    conversationKey: 'chat/~zod/latest',
    entry,
    isReady: true,
    isLoading: false,
    hasNewerPosts: false,
    listRef: list,
  });
  return (
    <>
      <PostList
        ref={list}
        channel={{ id: 'chat/~zod/latest', type: 'chat' }}
        numColumns={1}
        anchorToEnd
        anchor={null}
        collectionLayoutType="compact-list-bottom-to-top"
        postsWithNeighbors={[]}
        renderItem={() => null}
        isFocused={focused}
        scrollVisit={scrollVisit}
        onScrolledToBottomThreshold={1}
        onScrolledToBottom={latest.onScrolledToBottom}
        onScrolledAwayFromBottom={latest.onScrolledAwayFromBottom}
        onEndReachedThreshold={1}
        onEndReached={onEndReached}
      />
      <ConversationScrollToBottomButton
        visible={focused && !latest.atBottom}
        onPress={latest.onPress}
      />
    </>
  );
}
const scroller = () => host.querySelector<HTMLElement>('[tabindex]')!;
const control = () =>
  host.querySelector<HTMLElement>('[data-testid="ScrollToBottomButton"]')!;
async function render(focused = true) {
  await act(async () => root.render(<Harness focused={focused} />));
}
async function observeGap(gap: number) {
  await act(async () => {
    scroller().scrollTop = extent - viewport - gap;
    scroller().dispatchEvent(new Event('scroll'));
  });
}
function expectVisible(visible: boolean) {
  expect(control().style.opacity).toBe(visible ? '1' : '0');
  expect(control().style.pointerEvents).toBe(visible ? 'auto' : 'none');
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  document.head.innerHTML = '<style>*{opacity:1;visibility:visible}</style>';
  viewport = 699;
  extent = 1098;
  nextFrame = 0;
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => viewport
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    () => extent
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 600, viewport)
  );
  HTMLElement.prototype.scrollTo = function (
    options?: ScrollToOptions | number
  ) {
    if (!options || typeof options === 'number')
      throw Error('Unexpected overload');
    this.scrollTop = options.top ?? 0;
    this.dispatchEvent(new Event('scroll'));
  };
  onEndReached.mockClear();
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.head.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('actual web PostList to Latest presentation and command', () => {
  it('exposes Latest399px away within699px viewport and its ordinary press lands at end', async () => {
    await render();
    expectVisible(false);
    await observeGap(399);
    expectVisible(true);
    await act(async () => {
      control().querySelector('button')!.click();
    });
    const callbacks = [...frames.values()];
    frames.clear();
    await act(async () => {
      for (const callback of callbacks) callback(performance.now());
    });
    expect(scroller().scrollTop).toBe(extent - viewport);
    expectVisible(false);
  });
  it.each([300, 699, 1100])(
    'keeps the1px boundary independent of viewport%s',
    async (height) => {
      viewport = height;
      extent = height + 399;
      await render();
      await observeGap(1);
      expectVisible(false);
      await observeGap(1.01);
      expectVisible(true);
      await observeGap(0);
      expectVisible(false);
      await observeGap(-2);
      expectVisible(false);
    }
  );
  it('keeps pagination at one viewport while Latest uses the1px end distance', async () => {
    extent = 3000;
    await render();
    onEndReached.mockClear();
    await observeGap(700);
    expect(onEndReached).not.toHaveBeenCalled();
    await observeGap(699);
    expect(onEndReached).toHaveBeenCalledTimes(1);
    expectVisible(true);
  });
  it('keeps the current route interaction gate closed while covered and restores it on return', async () => {
    await render();
    await observeGap(399);
    expectVisible(true);
    await render(false);
    expectVisible(false);
    await render(true);
    expectVisible(true);
  });
});
