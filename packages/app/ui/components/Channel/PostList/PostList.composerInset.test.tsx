import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostList } from './PostList';

const state = vi.hoisted(() => ({
  platform: 'ios',
  heightHandler: undefined as undefined | ((height: number) => void),
  sendHandler: undefined as
    | undefined
    | { begin: () => void; finish: () => void },
  inset: 390,
  composerInset: undefined as undefined | { value: number },
  nativeScrolls: [] as number[],
  register: (handler: (height: number) => void) => {
    state.heightHandler = handler;
    return () => {};
  },
  registerSend: (handler: { begin: () => void; finish: () => void }) => {
    state.sendHandler = handler;
    return () => {};
  },
}));

vi.mock('@tloncorp/shared', () => ({
  layoutForType: () => ({ shouldMaintainVisibleContentPosition: true }),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34 }),
}));
vi.mock('../../../contexts/scroll', () => ({
  useConversationComposerHeight: () => ({
    register: state.register,
    registerSend: state.registerSend,
  }),
  useConversationScrollEndAnchor: () => null,
  useConversationScrollViewNativeID: () => 'conversation',
  useScrollDirectionTracker: () => ({ onScroll: () => {}, isAtBottom: true }),
}));
vi.mock('./PostListFlatList', () => ({ PostList: () => null }));
vi.mock('./usePostArrivalAnimation', () => ({
  usePostArrivalAnimation: ({ renderItem }: { renderItem: unknown }) =>
    renderItem,
}));
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await import('react');
  return {
    useReducedMotion: () => false,
    useSharedValue: (initial: number) =>
      useRef({
        value: initial,
        set(next: number) {
          this.value = next;
        },
      }).current,
  };
});
vi.mock('@legendapp/list/keyboard', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    KeyboardAwareLegendList: forwardRef(
      (props: { contentInsetEndAdjustment?: { value: number } }, ref) => {
        state.composerInset = props.contentInsetEndAdjustment;
        useImperativeHandle(ref, () => ({
          getState: () => ({ isNearEnd: true, listen: () => () => {} }),
          reportContentInset: ({ bottom }: { bottom: number }) => {
            state.inset = bottom;
          },
          scrollToEnd: async () => {
            // 1200 points of content in an 800-point viewport. The native
            // keyboard wrapper has already reported keyboard + composer inset.
            state.nativeScrolls.push(1200 - 800 + state.inset);
          },
        }));
        return null;
      }
    ),
  };
});

let renderer: ReactTestRenderer;
let frames: Map<number, FrameRequestCallback>;

beforeEach(() => {
  state.platform = 'ios';
  state.heightHandler = undefined;
  state.sendHandler = undefined;
  state.inset = 390;
  state.composerInset = undefined;
  state.nativeScrolls = [];
  frames = new Map();
  let nextFrame = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

function mount() {
  act(() => {
    renderer = create(
      <PostList
        anchor={null}
        anchorToEnd
        channel={{ id: 'chat' } as never}
        collectionLayoutType="compact-list-bottom-to-top"
        numColumns={1}
        postsWithNeighbors={
          [{ post: { id: 'post' }, previous: null, next: null }] as never
        }
        renderItem={() => null}
      />
    );
  });
}

function tick() {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(0)));
}

describe('conversation composer and keyboard insets', () => {
  it('keeps the keyboard in the end target when a single-line send retains the same height', () => {
    mount();
    act(() => state.heightHandler?.(90));
    expect(state.composerInset?.value).toBe(90);
    // KeyboardAwareLegendList reports the effective native inset once. An
    // unchanged composer height does not trigger another inset-change event.
    state.inset = 300 + 90;
    act(() => state.sendHandler?.begin());
    act(() => state.heightHandler?.(90));
    state.sendHandler?.finish();
    tick();
    expect(state.inset).toBe(390);
    expect(state.composerInset?.value).toBe(90);
    tick();
    expect(state.nativeScrolls).toEqual([790]);
  });

  it('leaves the last effective inset intact until native reports a contracted composer', () => {
    mount();
    act(() => state.heightHandler?.(180));
    expect(state.composerInset?.value).toBe(180);
    state.inset = 300 + 180;
    act(() => state.sendHandler?.begin());
    act(() => state.heightHandler?.(90));
    expect(state.composerInset?.value).toBe(180);
    state.sendHandler?.finish();
    tick();
    expect(state.inset).toBe(480);
    expect(state.composerInset?.value).toBe(90);
    state.inset = 300 + 90;
    tick();
    expect(state.nativeScrolls).toEqual([790]);
  });

  it('leaves Android inset reporting to its keyboard wrapper', () => {
    state.platform = 'android';
    mount();
    expect(state.heightHandler).toBeUndefined();
    expect(state.composerInset).toBeUndefined();
    act(() => state.sendHandler?.begin());
    state.sendHandler?.finish();
    tick();
    expect(state.inset).toBe(390);
    expect(state.nativeScrolls).toEqual([]);
  });
});
