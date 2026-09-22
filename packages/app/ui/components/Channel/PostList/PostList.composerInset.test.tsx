import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostList } from './PostList';

const state = vi.hoisted(() => ({
  platform: 'ios',
  docked: false,
  floating: false,
  setFloating: vi.fn(),
  positionHandler: undefined as
    | undefined
    | ((position: {
        offset: number;
        contentHeight: number;
        viewportHeight: number;
      }) => void),
  listProps: {} as Record<string, unknown>,
  geometry: { contentLength: 1200, scroll: 700, scrollLength: 500 },
  resizeScrolls: [] as { animated: boolean }[],
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
  StyleSheet: { flatten: (style: unknown) => style },
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
  useScrollDirectionTracker: (options: {
    onScrollPositionChange?: typeof state.positionHandler;
  }) => {
    state.positionHandler = options.onScrollPositionChange;
    return { onScroll: () => {}, isAtBottom: true };
  },
}));
vi.mock('../ConversationLayout', () => ({
  useIsConversationDocked: () => state.docked,
  useConversationComposerLayout: () => ({
    floating: state.floating,
    height: 90,
    setFloating: state.setFloating,
  }),
}));
vi.mock('./PostListFlatList', () => ({ PostList: () => null }));
vi.mock('./usePostArrivalAnimation', () => ({
  usePostArrivalAnimation: ({ renderItem }: { renderItem: unknown }) =>
    renderItem,
}));
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await import('react');
  return {
    default: { ScrollView: 'AnimatedScrollView' },
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
        state.listProps = props;
        state.composerInset = props.contentInsetEndAdjustment;
        useImperativeHandle(ref, () => ({
          getState: () => ({
            ...state.geometry,
            isNearEnd: true,
            listen: () => () => {},
          }),
          getNativeScrollRef: () => ({
            scrollToEnd: (options: { animated: boolean }) =>
              state.resizeScrolls.push(options),
          }),
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

vi.mock('@legendapp/list/reanimated', async () => ({
  AnimatedLegendList: (await import('@legendapp/list/keyboard'))
    .KeyboardAwareLegendList,
}));

let renderer: ReactTestRenderer;
let frames: Map<number, FrameRequestCallback>;

beforeEach(() => {
  state.platform = 'ios';
  state.docked = false;
  state.floating = false;
  state.setFloating.mockClear();
  state.positionHandler = undefined;
  state.listProps = {};
  state.geometry = { contentLength: 1200, scroll: 700, scrollLength: 500 };
  state.resizeScrolls = [];
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

function renderList() {
  return (
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
}

function mount() {
  act(() => {
    renderer = create(renderList());
  });
}

function update() {
  act(() => {
    renderer.update(renderList());
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

describe.each(['ios', 'android'])('docked %s conversation', (platform) => {
  it('lets the surrounding layout own keyboard space and coordinates sending without an inset', () => {
    state.platform = platform;
    state.docked = true;
    state.inset = 0;
    mount();
    expect(state.heightHandler).toBeUndefined();
    expect(state.composerInset).toBeUndefined();
    expect(state.listProps.keyboardLiftBehavior).toBeUndefined();
    expect(state.listProps.keyboardOffset).toBeUndefined();
    act(() => state.sendHandler?.begin());
    state.sendHandler?.finish();
    tick();
    tick();
    expect(state.inset).toBe(0);
    expect(state.nativeScrolls).toEqual([400]);
  });
});

function layout(height: number) {
  act(() =>
    (state.listProps.onLayout as (event: unknown) => void)({
      nativeEvent: { layout: { height } },
    })
  );
}

describe('docked conversation viewport changes', () => {
  beforeEach(() => {
    state.docked = true;
  });

  it('keeps the last message at the composer edge while the viewport shrinks and grows', () => {
    mount();
    layout(500);
    state.geometry.scrollLength = 400;
    layout(400);
    expect(state.resizeScrolls).toEqual([{ animated: false }]);
    state.geometry.scroll = 800;
    state.geometry.scrollLength = 450;
    layout(450);
    expect(state.resizeScrolls).toEqual([
      { animated: false },
      { animated: false },
    ]);
    expect(state.listProps.maintainScrollAtEnd).toMatchObject({
      on: { layout: false, dataChange: true },
    });
  });

  it('preserves history even when it is inside the incoming-message follow threshold', () => {
    mount();
    state.geometry.scroll = 600; // 100 points from the end of a 500-point viewport
    layout(500);
    state.geometry.scrollLength = 400;
    layout(400);
    expect(state.resizeScrolls).toEqual([]);
  });

  it('keeps following when scroll events trail resize frames, then releases on a user drag', () => {
    mount();
    layout(500);
    state.geometry.scrollLength = 450;
    layout(450);
    // Native has received scrollToEnd, but JS still sees the old offset.
    state.geometry.scrollLength = 400;
    layout(400);
    expect(state.resizeScrolls).toHaveLength(2);
    act(() => (state.listProps.onScrollBeginDrag as () => void)());
    // The reported offset is still at the OLD end when dismissal starts.
    state.geometry.scroll = 800;
    layout(350);
    expect(state.resizeScrolls).toHaveLength(2);
  });

  it('lets the send transition own composer contraction', () => {
    mount();
    layout(500);
    act(() => state.sendHandler?.begin());
    state.geometry.scrollLength = 600;
    layout(600);
    expect(state.resizeScrolls).toEqual([]);
  });
});

describe('floating conversation composer', () => {
  it('exchanges the inline space for a footer and stops automatic end following', () => {
    state.docked = true;
    state.floating = true;
    mount();
    expect(state.listProps.contentContainerStyle).toEqual([
      undefined,
      { paddingBottom: 90 },
    ]);
    expect(state.listProps.maintainScrollAtEnd).toBe(false);
    expect(state.listProps.maintainVisibleContentPosition).toBe(true);
    layout(500);
    layout(590);
    expect(state.resizeScrolls).toEqual([]);
    act(() => state.sendHandler?.begin());
    state.sendHandler?.finish();
    tick();
    tick();
    expect(state.nativeScrolls).toEqual([]);
  });
});

it('honors a history scroll delivered from the worklet after the drag ends', async () => {
  state.docked = true;
  mount();
  act(() => (state.listProps.onLoad as () => void)());
  tick();
  await act(async () => {
    tick();
  });
  act(() =>
    state.positionHandler?.({
      offset: 700,
      contentHeight: 1200,
      viewportHeight: 500,
    })
  );
  act(() => (state.listProps.onScrollBeginDrag as () => void)());
  act(() => (state.listProps.onScrollEndDrag as () => void)());
  act(() =>
    state.positionHandler?.({
      offset: 600,
      contentHeight: 1200,
      viewportHeight: 500,
    })
  );
  expect(state.setFloating).toHaveBeenLastCalledWith(true);
  // A subsequent send replaces the history gesture, including queued events.
  act(() => state.sendHandler?.begin());
  act(() =>
    state.positionHandler?.({
      offset: 550,
      contentHeight: 1200,
      viewportHeight: 500,
    })
  );
  expect(
    state.setFloating.mock.calls.filter(([floating]) => floating)
  ).toHaveLength(1);
});

describe('iOS native history anchoring', () => {
  it('keeps the native anchor attached while LegendList switches between end-following and history', () => {
    state.docked = true;
    mount();
    const renderScrollView = state.listProps.renderScrollComponent as (
      props: Record<string, unknown>
    ) => React.ReactElement<Record<string, unknown>>;
    const ref = React.createRef();
    const onScroll = vi.fn();
    const nativeProps = () =>
      renderScrollView({
        ref,
        onScroll,
        testID: 'conversation-scroll',
        maintainVisibleContentPosition: state.listProps
          .maintainVisibleContentPosition
          ? { minIndexForVisible: 0 }
          : undefined,
      }).props;

    // End-following intentionally disables LegendList's data/size adjustments,
    // but removing the native anchor here leaves iOS with a stale visible frame.
    expect(state.listProps.maintainVisibleContentPosition).toBe(false);
    expect(nativeProps()).toMatchObject({
      ref,
      onScroll,
      testID: 'conversation-scroll',
      maintainVisibleContentPosition: { minIndexForVisible: 0 },
    });
    state.floating = true;
    update();
    expect(state.listProps.maintainVisibleContentPosition).toBe(true);
    expect(state.listProps.maintainScrollAtEnd).toBe(false);
    expect(state.listProps.renderScrollComponent).toBe(renderScrollView);
    expect(nativeProps().maintainVisibleContentPosition).toEqual({
      minIndexForVisible: 0,
    });
    state.floating = false;
    update();
    act(() => state.sendHandler?.begin());
    expect(state.listProps.maintainVisibleContentPosition).toBe(false);
    expect(state.listProps.renderScrollComponent).toBe(renderScrollView);
    expect(nativeProps().maintainVisibleContentPosition).toEqual({
      minIndexForVisible: 0,
    });
  });

  it.each([
    ['android', true],
    ['ios', false],
  ])(
    'leaves the %s list with docked=%s on its existing scroll component',
    (platform, docked) => {
      state.platform = platform as string;
      state.docked = docked as boolean;
      mount();
      expect(state.listProps.renderScrollComponent).toBeUndefined();
    }
  );
});
