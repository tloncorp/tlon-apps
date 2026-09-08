import React, { createRef } from 'react';
import { useLifecyclePermit } from '../../../../hooks/useLifecyclePermit';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostList } from './PostList';
import type { PostListComponentProps, PostListMethods } from './shared';
import {
  ConversationListDiagnosticsContext,
  type ConversationListDiagnostics,
} from './diagnostics';
const mock = vi.hoisted(() => ({
  props: null as any,
  cancel: vi.fn(),
  endRequest: undefined as Promise<void> | undefined,
  end: vi.fn(),
  nativeEnd: vi.fn(),
  loadDuringLayout: false,
  index: vi.fn(),
  item: vi.fn(),
  platform: { OS: 'ios' as 'ios' | 'android' },
  offset: vi.fn(),
  state: { isNearEnd: true, listen: () => () => {} },
  anchor: null as any,
}));
vi.mock('@legendapp/list/keyboard', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    KeyboardAwareLegendList: React.forwardRef((props: any, ref) => {
      mock.props = props;
      React.useImperativeHandle(ref, () => ({
        getState: () => mock.state,
        // tinyspy wraps returned promises; observe the exact boundary result.
        scrollToEnd: (options: any) => {
          mock.endRequest = mock.end(options);
          return mock.endRequest;
        },
        cancelScroll: mock.cancel,
        scrollToIndex: mock.index,
        scrollToItem: mock.item,
        scrollToOffset: mock.offset,
        getNativeScrollRef: () => ({ scrollToEnd: mock.nativeEnd }),
        reportContentInset: () => {},
      }));
      React.useLayoutEffect(() => {
        if (mock.loadDuringLayout) props.onLoad();
      }, []);
      return React.createElement('NativeList', props);
    }),
  };
});
vi.mock('@tloncorp/shared', () => ({
  layoutForType: () => ({ shouldMaintainVisibleContentPosition: true }),
}));
vi.mock('react-native', () => ({
  Platform: mock.platform,
  PixelRatio: { get: () => 3 },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('react-native-reanimated', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    useSharedValue: (v: number) =>
      React.useMemo(() => ({ value: v, set: () => {} }), []),
    useAnimatedScrollHandler: (fn: any) => fn,
    useComposedEventHandler: (handlers: any) => handlers,
    runOnJS: (fn: any) => fn,
  };
});
vi.mock('../../../contexts/scroll', () => ({
  useConversationScrollViewNativeID: () => 'native-list',
  useConversationComposerHeight: () => ({ register: () => () => {} }),
  useConversationScrollEndAnchor: () => ({
    register: (handler: any) => {
      mock.anchor = handler;
      return () => {};
    },
  }),
  useScrollDirectionTracker: () => ({ onScroll: () => {}, isAtBottom: true }),
}));
vi.mock('./PostListFlatList', () => ({ PostList: 'FlatListBoundary' }));
let renderer: ReactTestRenderer | undefined;
let frames: (() => void)[];
let ref: React.RefObject<PostListMethods | null>;
const props = (
  extra: Partial<PostListComponentProps> = {}
): PostListComponentProps => ({
  channel: { id: 'chat/a' } as any,
  anchor: null,
  anchorToEnd: true,
  collectionLayoutType: 'compact-list-bottom-to-top',
  numColumns: 1,
  postsWithNeighbors: [
    { post: { id: 'one', type: 'chat' } as any, previous: null, next: null },
  ],
  renderItem: () => null,
  ...extra,
});
const gesture = (gap: number) => ({
  nativeEvent: {
    contentOffset: { y: 1000 - gap },
    contentSize: { height: 1500 },
    layoutMeasurement: { height: 500 },
    contentInset: { bottom: 0 },
  },
});
function VisibleVisit({ extra }: { extra: Partial<PostListComponentProps> }) {
  const visit = useLifecyclePermit(
    [extra.channel?.id ?? 'chat/a'],
    extra.isFocused ?? true
  );
  return <PostList {...props(extra)} scrollVisit={visit} ref={ref} />;
}
async function render(
  extra: Partial<PostListComponentProps> = {},
  diagnostics: ConversationListDiagnostics | null = null
) {
  await act(async () => {
    const element = (
      <ConversationListDiagnosticsContext.Provider value={diagnostics}>
        <VisibleVisit extra={extra} />
      </ConversationListDiagnosticsContext.Provider>
    );
    if (renderer) renderer.update(element);
    else renderer = create(element);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  frames = [];
  ref = createRef();
  mock.end.mockReset();
  mock.cancel.mockReset();
  mock.endRequest = undefined;
  mock.nativeEnd.mockReset();
  mock.loadDuringLayout = false;
  mock.index.mockReset();
  mock.item.mockReset();
  mock.platform.OS = 'ios';
  mock.offset.mockReset();
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
    frames.push(fn);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});
function nativeReadDescriptor() {
  const header = React.Children.toArray(
    mock.props.ListHeaderComponent.props.children
  )[0] as React.ReactElement<{ descriptor: string }>;
  return JSON.parse(header.props.descriptor);
}

describe('native reading metadata at the actual list boundary', () => {
  it('timing-only updates retain the visit, READ ownership and diagnostic attachment', async () => {
    const detach = vi.fn();
    const diagnostics = { attach: vi.fn(() => detach), event: vi.fn() };
    const listProps = props();
    await render(listProps, diagnostics);
    act(() => mock.props.onScrollBeginDrag());
    const plain = nativeReadDescriptor();
    expect(plain.phase).toBe('read');
    const attachments = diagnostics.attach.mock.calls.length;
    const detachments = detach.mock.calls.length;
    mock.end.mockClear();
    mock.index.mockClear();
    mock.item.mockClear();
    for (const nativeReadTimingSession of ['r13.a', 'r13.b', undefined]) {
      await render(listProps, { ...diagnostics, nativeReadTimingSession });
      expect(nativeReadDescriptor()).toEqual({
        ...plain,
        ...(nativeReadTimingSession
          ? { diagnosticTimingSession: nativeReadTimingSession }
          : {}),
      });
      expect(mock.props.nativeReadPointIntent).toBe(plain.intent);
      expect(mock.props.nativeReadPointCorrection).toBe(true);
      expect(diagnostics.attach).toHaveBeenCalledTimes(attachments);
      expect(detach).toHaveBeenCalledTimes(detachments);
      expect(mock.end).not.toHaveBeenCalled();
      expect(mock.index).not.toHaveBeenCalled();
      expect(mock.item).not.toHaveBeenCalled();
    }
  });
  it('bootstrap remains TARGET until a real gesture takes over the viewport', async () => {
    await render();
    expect(nativeReadDescriptor().phase).toBe('target');
    expect(mock.props.nativeReadPointIntent).toBe(
      nativeReadDescriptor().intent
    );
    expect(mock.props.nativeReadPointCorrection).toBe(false);
    act(() => mock.props.onScrollBeginDrag());
    expect(nativeReadDescriptor().phase).toBe('read');
    expect(mock.props.nativeReadPointIntent).toBe(
      nativeReadDescriptor().intent
    );
    expect(mock.props.nativeReadPointCorrection).toBe(true);
    // Routing asks the native mount arbiter; this test does not grant a lease.
  });
  it('newer same-mode selection keeps READ suspended after an old promise settles', async () => {
    await render();
    act(() => mock.props.onScrollBeginDrag());
    let first!: () => void;
    let second!: () => void;
    mock.item.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          first = done;
        })
    );
    mock.item.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          second = done;
        })
    );
    act(() => ref.current!.scrollToPost({ postId: 'one' }));
    const oldIntent = nativeReadDescriptor().intent;
    expect(nativeReadDescriptor().phase).toBe('target');
    act(() => ref.current!.scrollToPost({ postId: 'one' }));
    const intent = nativeReadDescriptor().intent;
    expect(intent).not.toBe(oldIntent);
    await act(async () => first());
    expect(nativeReadDescriptor()).toMatchObject({ intent, phase: 'target' });
    expect(mock.props.nativeReadPointCorrection).toBe(false);
    await act(async () => second());
    expect(nativeReadDescriptor()).toMatchObject({ intent, phase: 'read' });
    expect(mock.props.nativeReadPointCorrection).toBe(true);
  });
  it('live edits retain membership while removal and reinsertion change incarnation', async () => {
    await render();
    act(() => mock.props.onScrollBeginDrag());
    const before = nativeReadDescriptor();
    await render({
      postsWithNeighbors: [
        {
          post: { id: 'one', type: 'chat', content: 'edited' } as any,
          previous: null,
          next: null,
        },
      ],
    });
    expect(nativeReadDescriptor()).toMatchObject({
      rows: before.rows,
      intent: before.intent,
    });
    await render({ postsWithNeighbors: [] });
    expect(nativeReadDescriptor().rows).toEqual([]);
    await render();
    expect(nativeReadDescriptor().rows[0].revision).not.toBe(
      before.rows[0].revision
    );
  });
  it('covered content declares inactive and returning cannot restore the old intent', async () => {
    await render();
    act(() => mock.props.onScrollBeginDrag());
    const before = nativeReadDescriptor();
    await render({ isFocused: false });
    expect(nativeReadDescriptor().phase).toBe('inactive');
    expect(mock.props.nativeReadPointCorrection).toBe(false);
    await render({ isFocused: true });
    expect(nativeReadDescriptor()).toMatchObject({
      phase: 'read',
      visit: before.visit,
    });
    expect(nativeReadDescriptor().intent).not.toBe(before.intent);
  });
  it('Android keeps its original list header and relative adjustment route', async () => {
    mock.platform.OS = 'android';
    const header = <React.Fragment>existing header</React.Fragment>;
    await render({ listHeaderComponent: header });
    act(() => mock.props.onScrollBeginDrag());
    expect(mock.props.ListHeaderComponent).toBe(header);
    expect(mock.props.nativeReadPointCorrection).toBe(false);
  });
});
describe('real native PostList ownership wiring (native layout boundary)', () => {
  it('accepts initial onLoad captured by a child before the exact parent visit commits', async () => {
    const ready = vi.fn();
    mock.loadDuringLayout = true;
    await render({ onInitialScrollCompleted: ready });
    expect(frames).toHaveLength(1);
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
    expect(mock.end).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it.each(['append', 'thinking-footer', 'viewport'] as const)(
    'iOS leaves passive %s following to the exact native commit owner',
    async (trigger) => {
      await render();
      expect(mock.props.onLayout).toBeUndefined();
      expect(mock.props.onContentSizeChange).toBeUndefined();
      expect(mock.nativeEnd).not.toHaveBeenCalled();
      expect(frames).toHaveLength(0);
      expect(mock.props.maintainScrollAtEnd).toBe(false);
      // No native commit is simulated here; RN host controls hold JS delivery.
      expect(trigger).toBeTruthy();
    }
  );
  it('Android rejects passive correction in READ, focus ABA and unloaded newer posts', async () => {
    mock.platform.OS = 'android';
    await render();
    const oldContentSize = mock.props.onContentSizeChange;
    act(() => mock.props.onScrollBeginDrag());
    mock.props.onContentSizeChange(402, 11190);
    expect(mock.nativeEnd).not.toHaveBeenCalled();
    await render({ isFocused: false });
    mock.props.onContentSizeChange(402, 11242);
    await render({ isFocused: true });
    oldContentSize(402, 11294);
    expect(mock.nativeEnd).not.toHaveBeenCalled();
    await act(async () => ref.current!.scrollToEnd({}));
    mock.props.onContentSizeChange(402, 11346);
    expect(mock.nativeEnd).toHaveBeenCalledTimes(1);
    await render({ hasNewerPosts: true });
    mock.props.onContentSizeChange(402, 11398);
    expect(mock.nativeEnd).toHaveBeenCalledTimes(1);
  });

  it('Android retains immediate passive footer/layout compensation', async () => {
    mock.platform.OS = 'android';
    await render();
    mock.props.onContentSizeChange(402, 11112);
    mock.props.onLayout({ nativeEvent: { layout: { height: 671 } } });
    expect(mock.nativeEnd).toHaveBeenCalledTimes(2);
    expect(mock.nativeEnd).toHaveBeenLastCalledWith({ animated: false });
  });
  it('iOS native FOLLOW is published only after the current latest command completes', async () => {
    await render();
    let finish!: () => void;
    mock.end.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    act(() => ref.current!.scrollToEnd({ animated: false }));
    const intent = nativeReadDescriptor().intent;
    expect(nativeReadDescriptor()).toMatchObject({ intent, phase: 'target' });
    await act(async () => finish());
    expect(nativeReadDescriptor()).toMatchObject({ intent, phase: 'follow' });
    expect(mock.props.onContentSizeChange).toBeUndefined();
    expect(mock.nativeEnd).not.toHaveBeenCalled();
  });
  it('covered old latest completion cannot publish FOLLOW; fresh latest can', async () => {
    await render();
    let oldFinish!: () => void;
    mock.end.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          oldFinish = resolve;
        })
    );
    act(() => ref.current!.scrollToEnd({ animated: false }));
    const oldIntent = nativeReadDescriptor().intent;
    await render({ isFocused: false });
    await render({ isFocused: true });
    await act(async () => oldFinish());
    expect(nativeReadDescriptor().phase).not.toBe('follow');
    expect(nativeReadDescriptor().intent).not.toBe(oldIntent);
    await act(async () => ref.current!.scrollToEnd({ animated: false }));
    expect(nativeReadDescriptor().phase).toBe('follow');
    expect(mock.nativeEnd).not.toHaveBeenCalled();
  });
  it('route blur revokes captured intent and passive following while retaining native rows and inset bookkeeping', async () => {
    await render({ isFocused: true });
    const mounted = renderer!.root.findByType('NativeList' as any);
    const permit = ref.current!.captureScrollIntent!();
    expect(permit()).toBe(true);
    await render({ isFocused: false, contentInsets: { top: 30, bottom: 180 } });
    expect(permit()).toBe(false);
    expect(ref.current!.captureScrollIntent!()()).toBe(false);
    expect(mock.props.maintainScrollAtEnd).toBe(false);
    expect(mock.props.keyboardLiftBehavior).toBe('never');
    expect(mock.props.maintainVisibleContentPosition).toBe(true);
    expect(renderer!.root.findByType('NativeList' as any)).toBe(mounted);
    await render({ isFocused: true, contentInsets: { top: 30, bottom: 180 } });
    expect(permit()).toBe(false);
    expect(ref.current!.captureScrollIntent!()()).toBe(true);
    // Route cover preserves the return reading point, even from old bottom.
    expect(mock.props.maintainScrollAtEnd).toBe(false);
    expect(mock.props.keyboardLiftBehavior).toBe('never');
    expect(mock.end).not.toHaveBeenCalled();
    await act(async () => ref.current!.scrollToEnd({ animated: false }));
    expect(mock.props.keyboardLiftBehavior).toBe('always');
    expect(mock.end).toHaveBeenCalledTimes(1);
  });

  it('an old registered end-anchor callback cannot restore after route cover and return', async () => {
    await render({ isFocused: true });
    const oldHandler = mock.anchor;
    oldHandler.capture();
    await render({ isFocused: false });
    await render({ isFocused: true });
    await act(async () => oldHandler.restore());
    expect(mock.end).not.toHaveBeenCalled();
    await act(async () => ref.current!.scrollToEnd({ animated: false }));
    mock.end.mockClear();
    mock.anchor.capture();
    await act(async () => mock.anchor.restore());
    expect(mock.end).toHaveBeenCalledTimes(1);
  });

  it('an already dequeued failed-scroll retry stays cancelled after route focus ABA', async () => {
    await render({ isFocused: true });
    mock.end.mockRejectedValueOnce(new Error('measurement pending'));
    await act(async () => ref.current!.scrollToEnd({ animated: true }));
    expect(frames).toHaveLength(1);
    const oldRetry = frames.shift()!;
    await render({ isFocused: false });
    await render({ isFocused: true });
    await act(async () => oldRetry());
    expect(mock.end).toHaveBeenCalledTimes(1);
    await act(async () => ref.current!.scrollToEnd({ animated: true }));
    expect(mock.end).toHaveBeenCalledTimes(2);
  });

  it('retains covered footer measurements for a fresh visible final-row target', async () => {
    await render({ isFocused: true });
    await render({ isFocused: false });
    act(() => mock.props.onMetricsChange({ footerSize: 52 }));
    await render({ isFocused: true });
    await act(async () => ref.current!.scrollToPost({ postId: 'one' }));
    expect(mock.item).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewOffset: 52 })
    );
  });

  it('disables end/keyboard following on drag despite near-end geometry and reflow', async () => {
    await render();
    expect(mock.props.keyboardLiftBehavior).toBe('always');
    act(() => mock.props.onScrollBeginDrag());
    expect(mock.props.maintainScrollAtEnd).toBe(false);
    expect(mock.props.maintainVisibleContentPosition).toBe(true);
    expect(mock.props.keyboardLiftBehavior).toBe('never');
    await render({ contentInsets: { top: 120, bottom: 180 } });
    expect(mock.props.maintainScrollAtEnd).toBe(false);
    act(() => mock.props.onScrollEndDrag(gesture(30)));
    expect(mock.props.maintainScrollAtEnd).toBe(false);
    act(() => mock.props.onMomentumScrollEnd(gesture(0)));
    expect(mock.props.keyboardLiftBehavior).toBe('always');
  });
  it('does not follow a selected anchor because geometry is near-end', async () => {
    await render({
      anchor: { type: 'selected', postId: 'one' },
      contentInsets: { top: 120, bottom: 140 },
    });
    expect(mock.props.maintainScrollAtEnd).toBe(false);
    expect(mock.props.initialScrollIndex).toMatchObject({
      index: 0,
      viewPosition: 0.5,
      viewOffset: 60,
    });
  });
  it('revokes captured work through drag, bottom return and replacement', async () => {
    await render();
    const old = ref.current!.captureScrollIntent!();
    act(() => mock.props.onScrollBeginDrag());
    act(() => mock.props.onScrollEndDrag(gesture(0)));
    expect(old()).toBe(false);
    const next = ref.current!.captureScrollIntent!();
    await render({ channel: { id: 'chat/b' } as any });
    expect(next()).toBe(false);
  });
  it('does not restore a composer capture after explicit selected navigation', async () => {
    await render();
    mock.anchor.capture();
    act(() => ref.current!.scrollToPost({ postId: 'one' }));
    mock.anchor.restore();
    expect(mock.end).not.toHaveBeenCalled();
    expect(mock.item).toHaveBeenCalledTimes(1);
  });
  it('cancels a queued failed latest retry when a drag takes ownership', async () => {
    await render();
    mock.end.mockRejectedValue(new Error('measurement'));
    await act(async () => {
      ref.current!.scrollToEnd({ animated: true });
    });
    expect(frames).toHaveLength(1);
    act(() => mock.props.onScrollBeginDrag());
    await act(async () => frames.splice(0).forEach((fn) => fn()));
    expect(mock.end).toHaveBeenCalledTimes(1);
  });
  it('completes readiness through the current imperative takeover rather than its obsolete initial promise', async () => {
    const ready = vi.fn();
    let resolveOld!: () => void;
    mock.end.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveOld = resolve;
        })
    );
    await render({ onInitialScrollCompleted: ready });
    act(() => mock.props.onLoad());
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
    expect(ready).not.toHaveBeenCalled();
    await act(async () => ref.current!.scrollToPost({ postId: 'one' }));
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mock.props.style).not.toContainEqual({ opacity: 0 });
    await act(async () => resolveOld());
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('allows a current drag to reveal without waiting for obsolete initial work', async () => {
    const ready = vi.fn();
    let resolveOld!: () => void;
    mock.end.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveOld = resolve;
        })
    );
    await render({ onInitialScrollCompleted: ready });
    act(() => mock.props.onLoad());
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
    act(() => mock.props.onScrollBeginDrag());
    expect(ready).toHaveBeenCalledTimes(1);
    await act(async () => resolveOld());
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('ignores stale first and nested RAF callbacks after same-owner rescheduling', async () => {
    await render();
    act(() => mock.props.onLoad());
    const oldFirst = frames.shift()!;
    act(() => oldFirst());
    const oldSecond = frames.shift()!;
    act(() => mock.props.onLoad());
    const newFirst = frames.shift()!;
    act(() => {
      oldFirst();
      oldSecond();
    });
    expect(frames).toHaveLength(0);
    act(() => newFirst());
    await act(async () => frames.shift()!());
    expect(mock.end).toHaveBeenCalledTimes(1);
  });
  it('notifies user/explicit intent changes without notifying passive inset compensation', async () => {
    const changed = vi.fn();
    await render({ onScrollIntentChanged: changed });
    mock.anchor.capture();
    await act(async () => mock.anchor.restore());
    expect(changed).not.toHaveBeenCalled();
    act(() => mock.props.onScrollBeginDrag());
    await act(async () => ref.current!.scrollToEnd({}));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('compensates a measured thinking footer when selecting the final row', async () => {
    await render({
      anchor: { type: 'selected', postId: 'one' },
      contentInsets: { top: 120, bottom: 140 },
    });
    act(() => mock.props.onMetricsChange({ footerSize: 52 }));
    expect(mock.props.initialScrollIndex.viewOffset).toBe(112);
    await act(async () =>
      ref.current!.scrollToPost({ postId: 'one', viewPosition: 0.5 })
    );
    expect(mock.item).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewOffset: 112 })
    );
    act(() => mock.props.onMetricsChange({ footerSize: 0 }));
    await act(async () =>
      ref.current!.scrollToPost({ postId: 'one', viewPosition: 0.5 })
    );
    expect(mock.item).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewOffset: 60 })
    );
  });
});

describe('bounded terminal indexed failure recovery', () => {
  const failure = {
    code: 'LEGEND_SCROLL_UNALIGNED',
    index: 0,
    requestedOffset: 100,
    currentOffset: 100,
    observedOffset: 140,
  };
  const latest = (events: ReturnType<typeof vi.fn>) => {
    const action = events.mock.calls
      .filter(([value]) => value !== null)
      .at(-1)?.[0];
    expect(action, 'terminal failure must expose a retry action').toBeTruthy();
    expect(typeof action.retry).toBe('function');
    return action as { retry: () => void };
  };
  const startInitial = async () => {
    act(() => mock.props.onLoad());
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
  };
  const flushInitial = async () => {
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
  };
  it('typed initial exhaustion is not readiness and does not automatically retry', async () => {
    const ready = vi.fn();
    const recovery = vi.fn();
    mock.end.mockRejectedValue(failure);
    await render(
      Object.assign(
        {},
        {
          onInitialScrollCompleted: ready,
          onInitialScrollRecoveryChange: recovery,
        }
      )
    );
    await startInitial();
    expect(ready).not.toHaveBeenCalled();
    latest(recovery);
    expect(mock.end).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
    expect(mock.props.style).toContainEqual({ opacity: 0 });
  });
  it('one user retry uses fresh initial work and only success reveals', async () => {
    const ready = vi.fn();
    const recovery = vi.fn();
    mock.end.mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    await render(
      Object.assign(
        {},
        {
          onInitialScrollCompleted: ready,
          onInitialScrollRecoveryChange: recovery,
        }
      )
    );
    const mounted = renderer!.root.findByType('NativeList' as any);
    await startInitial();
    const action = latest(recovery);
    act(() => {
      action.retry();
      action.retry();
    });
    expect(frames).toHaveLength(1);
    expect(ready).not.toHaveBeenCalled();
    await flushInitial();
    expect(mock.end).toHaveBeenCalledTimes(2);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(recovery.mock.calls.at(-1)?.[0]).toBeNull();
    expect(renderer!.root.findByType('NativeList' as any)).toBe(mounted);
  });
  it('failed public selected command retries that selected target instead of initial latest', async () => {
    const ready = vi.fn();
    const recovery = vi.fn();
    mock.item.mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    await render(
      Object.assign(
        {},
        {
          onInitialScrollCompleted: ready,
          onInitialScrollRecoveryChange: recovery,
        }
      )
    );
    await act(async () =>
      ref.current!.scrollToPost({
        postId: 'one',
        animated: false,
        viewPosition: 0.25,
      })
    );
    expect(ready).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
    const action = latest(recovery);
    await act(async () => action.retry());
    expect(mock.item).toHaveBeenCalledTimes(2);
    expect(mock.item.mock.calls[1][0]).toMatchObject({
      animated: false,
      viewPosition: 0.25,
    });
    expect(mock.end).not.toHaveBeenCalled();
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('old retry remains retired across focus ABA while returned error offers a fresh retry', async () => {
    const ready = vi.fn();
    const recovery = vi.fn();
    mock.end.mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const callbacks = {
      onInitialScrollCompleted: ready,
      onInitialScrollRecoveryChange: recovery,
    };
    await render(Object.assign({}, callbacks));
    await startInitial();
    const old = latest(recovery);
    await render(Object.assign({}, callbacks, { isFocused: false }));
    await render(Object.assign({}, callbacks, { isFocused: true }));
    expect(ready).not.toHaveBeenCalled();
    const fresh = latest(recovery);
    expect(fresh).not.toBe(old);
    act(() => old.retry());
    expect(frames).toHaveLength(0);
    act(() => fresh.retry());
    await flushInitial();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mock.end).toHaveBeenCalledTimes(2);
  });
  it('terminal failure after readiness leaves content visible without a new completion', async () => {
    const ready = vi.fn();
    const recovery = vi.fn();
    await render(
      Object.assign(
        {},
        {
          onInitialScrollCompleted: ready,
          onInitialScrollRecoveryChange: recovery,
        }
      )
    );
    await startInitial();
    const mounted = renderer!.root.findByType('NativeList' as any);
    mock.end.mockRejectedValue(failure);
    await act(async () => ref.current!.scrollToEnd({ animated: false }));
    expect(frames).toHaveLength(0);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(recovery).not.toHaveBeenCalled();
    expect(mock.props.style).not.toContainEqual({ opacity: 0 });
    expect(renderer!.root.findByType('NativeList' as any)).toBe(mounted);
  });
});

describe('post identity at the actual imperative boundary', () => {
  const item = (id: string, revision: number) => ({
    post: { id, type: 'chat', content: `revision-${revision}` } as any,
    previous: null,
    next: null,
  });
  const startInitial = async () => {
    act(() => mock.props.onLoad());
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
  };
  it('iOS public selection passes the current item and extractor key, never its numeric index', async () => {
    const target = item('two', 1);
    await render({ postsWithNeighbors: [item('one', 0), target] });
    await act(async () =>
      ref.current!.scrollToPost({
        postId: 'two',
        animated: false,
        viewPosition: 0.25,
      })
    );
    expect(mock.item).toHaveBeenCalledTimes(1);
    expect(mock.item.mock.calls[0][0].item).toBe(target);
    expect(mock.props.keyExtractor(mock.item.mock.calls[0][0].item)).toBe(
      'two'
    );
    expect(mock.item.mock.calls[0][0]).toMatchObject({
      animated: false,
      viewPosition: 0.25,
    });
    expect(mock.item.mock.calls[0][0]).not.toHaveProperty('index');
    expect(mock.index).not.toHaveBeenCalled();
  });
  it.each(['ios', 'android'] as const)(
    '%s selected/unread corrections preserve the platform dispatch contract',
    async (platform) => {
      mock.platform.OS = platform;
      for (const type of ['selected', 'unread'] as const) {
        const target = item(type, 1);
        await render({
          anchor: { type, postId: type },
          postsWithNeighbors: [target],
          contentInsets: { top: 120, bottom: 140 },
        });
        expect(mock.props.initialScrollIndex).toMatchObject({
          index: 0,
          viewPosition: type === 'selected' ? 0.5 : 0,
        });
        await startInitial();
        const command = platform === 'ios' ? mock.item : mock.index;
        expect(command.mock.calls.at(-1)?.[0]).toMatchObject({
          animated: false,
          viewPosition: type === 'selected' ? 0.5 : 0,
        });
        if (platform === 'ios')
          expect(command.mock.calls.at(-1)?.[0].item).toBe(target);
        else expect(command.mock.calls.at(-1)?.[0].index).toBe(0);
      }
      expect(
        platform === 'ios' ? mock.index : mock.item
      ).not.toHaveBeenCalled();
    }
  );
  it('queued explicit anchor resolves the immutable replacement committed before its dispatch', async () => {
    const first = item('one', 1);
    const replacement = item('one', 2);
    const anchor = { type: 'selected' as const, postId: 'one' };
    await render({ anchor, postsWithNeighbors: [first] });
    act(() => mock.props.onLoad());
    act(() => frames.shift()!());
    await render({ anchor, postsWithNeighbors: [replacement] });
    await act(async () => frames.shift()!());
    expect(mock.item).toHaveBeenCalledTimes(1);
    expect(mock.item.mock.calls[0][0].item).toBe(replacement);
    expect(mock.item.mock.calls[0][0].item).not.toBe(first);
  });
  it('Retry re-resolves the stable post ID to the current immutable item', async () => {
    const first = item('one', 1);
    const replacement = item('one', 2);
    const recovery = vi.fn();
    const ready = vi.fn();
    const callbacks = {
      onInitialScrollRecoveryChange: recovery,
      onInitialScrollCompleted: ready,
    };
    mock.item
      .mockRejectedValueOnce({
        code: 'LEGEND_SCROLL_UNALIGNED',
        reason: 'target-missing',
        key: 'one',
      })
      .mockResolvedValue(undefined);
    await render(Object.assign({}, callbacks, { postsWithNeighbors: [first] }));
    await act(async () =>
      ref.current!.scrollToPost({ postId: 'one', animated: false })
    );
    expect(ready).not.toHaveBeenCalled();
    const action = recovery.mock.calls
      .filter(([value]) => value !== null)
      .at(-1)?.[0];
    expect(action).toBeTruthy();
    await render(
      Object.assign({}, callbacks, { postsWithNeighbors: [replacement] })
    );
    await act(async () => action.retry());
    expect(mock.item).toHaveBeenCalledTimes(2);
    expect(mock.item.mock.calls[0][0].item).toBe(first);
    expect(mock.item.mock.calls[1][0].item).toBe(replacement);
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it.each(['ios', 'android'] as const)(
    '%s missing public target remains a terminal owned failure, then Retry can find it',
    async (platform) => {
      mock.platform.OS = platform;
      const recovery = vi.fn();
      const ready = vi.fn();
      const callbacks = {
        onInitialScrollRecoveryChange: recovery,
        onInitialScrollCompleted: ready,
      };
      await render(Object.assign({}, callbacks));
      await act(async () =>
        ref.current!.scrollToPost({ postId: 'missing', animated: false })
      );
      expect(ready).not.toHaveBeenCalled();
      expect(mock.item).not.toHaveBeenCalled();
      expect(mock.index).not.toHaveBeenCalled();
      expect(frames).toHaveLength(0);
      const action = recovery.mock.calls
        .filter(([value]) => value !== null)
        .at(-1)?.[0];
      expect(action).toBeTruthy();
      const target = item('missing', 1);
      await render(
        Object.assign({}, callbacks, {
          postsWithNeighbors: [item('one', 1), target],
        })
      );
      await act(async () => action.retry());
      expect(ready).toHaveBeenCalledTimes(1);
      if (platform === 'ios')
        expect(mock.item.mock.calls[0][0].item).toBe(target);
      else expect(mock.index.mock.calls[0][0].index).toBe(1);
    }
  );
  it('non-iOS public post selection and numeric start/end remain unchanged', async () => {
    mock.platform.OS = 'android';
    await render({ postsWithNeighbors: [item('one', 1), item('two', 1)] });
    await act(async () =>
      ref.current!.scrollToPost({
        postId: 'two',
        animated: false,
        viewPosition: 0.25,
      })
    );
    expect(mock.index).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1, animated: false, viewPosition: 0.25 })
    );
    expect(mock.item).not.toHaveBeenCalled();
    await act(async () => ref.current!.scrollToStart({ animated: false }));
    expect(mock.offset).toHaveBeenCalledWith({ offset: 0, animated: false });
    await act(async () => ref.current!.scrollToEnd({ animated: false }));
    expect(mock.end).toHaveBeenCalledWith({ animated: false });
  });
});

describe('native post message geometry resolver', () => {
  function geometryProps() {
    const data = [
      {
        post: { id: 'one', channelId: 'chat/a', type: 'chat' } as any,
        previous: null,
        next: null,
      },
    ];
    const get = vi.fn((_key: string, _size: number) => ({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    }));
    return {
      data,
      get,
      extra: {
        postsWithNeighbors: data,
        targetLayouts: {
          scope: 'chat/a',
          get,
          createLease: () => ({
            activate() {},
            deactivate() {},
            layout() {},
            invalidate() {},
          }),
        },
        contentInsets: { top: 56, bottom: 80 },
      } as Partial<PostListComponentProps>,
    };
  }
  it('corrects the actual R6 fractional cell/message center instead of assuming a four-point constant', async () => {
    const g = geometryProps();
    const height = 129.666992;
    const indexed = 129.625;
    g.get.mockReturnValue({
      leading: 0,
      trailing: 8,
      cellSizeDelta: indexed - height,
    } as never);
    await render(g.extra);
    await act(async () =>
      ref.current!.scrollToPost({
        postId: 'one',
        viewPosition: 0.5,
        animated: false,
      })
    );
    const call = mock.item.mock.calls.at(-1)![0];
    expect(
      call.getViewOffset({
        item: g.data[0],
        key: 'one',
        index: 0,
        itemSize: indexed,
      })
    ).toBe(28 + 0.5 * (indexed - (height - 8)));
  });
  it('supplies current complete message decoration through a full iOS resolver', async () => {
    const g = geometryProps();
    await render(g.extra);
    await act(async () =>
      ref.current!.scrollToPost({
        postId: 'one',
        viewPosition: 0.5,
        animated: false,
      })
    );
    const call = mock.item.mock.calls.at(-1)![0];
    expect(typeof call.getViewOffset).toBe('function');
    const current = { item: g.data[0], key: 'one', index: 0, itemSize: 128 };
    expect(call.getViewOffset(current)).toBe(32);
    expect(g.get).toHaveBeenLastCalledWith('one', 128, 3);
    g.get.mockReturnValue({ leading: 48, trailing: 8, cellSizeDelta: 0 });
    expect(call.getViewOffset({ ...current, itemSize: 176 })).toBe(8);
    expect(g.get).toHaveBeenLastCalledWith('one', 176, 3);
  });
  it('retains the same pending request while its decoration becomes unavailable and ready', async () => {
    const g = geometryProps();
    mock.item.mockReturnValue(new Promise<void>(() => {}));
    await render(g.extra);
    await act(async () =>
      ref.current!.scrollToPost({ postId: 'one', viewPosition: 0.5 })
    );
    const call = mock.item.mock.calls.at(-1)![0];
    expect(typeof call.getViewOffset).toBe('function');
    const current = { item: g.data[0], key: 'one', index: 0, itemSize: 128 };
    expect(call.getViewOffset(current)).toBe(32);
    g.get.mockReturnValueOnce(undefined as never);
    expect(call.getViewOffset(current)).toBeUndefined();
    g.get.mockReturnValue({ leading: 0, trailing: 0, cellSizeDelta: 0 });
    expect(call.getViewOffset({ ...current, itemSize: 120 })).toBe(28);
    expect(mock.item).toHaveBeenCalledTimes(1);
  });
  it('rejects old visit getters after focus ABA and rejects another current item', async () => {
    const g = geometryProps();
    await render(g.extra);
    await act(async () =>
      ref.current!.scrollToPost({ postId: 'one', viewPosition: 0.5 })
    );
    const getViewOffset = mock.item.mock.calls.at(-1)![0].getViewOffset;
    expect(typeof getViewOffset).toBe('function');
    const current = { item: g.data[0], key: 'one', index: 0, itemSize: 128 };
    expect(
      getViewOffset({ ...current, item: { ...g.data[0] } })
    ).toBeUndefined();
    expect(getViewOffset({ ...current, key: 'other' })).toBeUndefined();
    await render({ ...g.extra, isFocused: false });
    await render({ ...g.extra, isFocused: true });
    expect(getViewOffset(current)).toBeUndefined();
  });
  it('leaves selected/unread initial cell targeting and Android public dispatch unchanged', async () => {
    const g = geometryProps();
    await render({ ...g.extra, anchor: { type: 'unread', postId: 'one' } });
    act(() => mock.props.onLoad());
    act(() => frames.shift()!());
    await act(async () => frames.shift()!());
    expect(mock.item.mock.calls.at(-1)![0].getViewOffset).toBeUndefined();
    expect(mock.item.mock.calls.at(-1)![0].viewOffset).toBe(56);
    mock.platform.OS = 'android';
    await render(g.extra);
    await act(async () =>
      ref.current!.scrollToPost({ postId: 'one', viewPosition: 0.5 })
    );
    expect(mock.index.mock.calls.at(-1)![0].getViewOffset).toBeUndefined();
    expect(mock.index.mock.calls.at(-1)![0].viewOffset).toBe(-12);
  });
});

// Native dispatch/completion is covered separately by the installed-source runner.
it('retires the exact accepted promise on route cover and keeps it retired on return', async () => {
  let reject!: (reason: unknown) => void;
  const pending = new Promise<void>((_resolve, failure) => {
    reject = failure;
  });
  await render({ isFocused: true });
  mock.end.mockReturnValueOnce(pending);
  mock.cancel.mockImplementation((request) => {
    expect(request).toBe(mock.endRequest);
    reject(
      Object.assign(new Error('cancelled'), { code: 'LEGEND_SCROLL_CANCELLED' })
    );
    return true;
  });
  await act(async () => ref.current!.scrollToEnd({ animated: false }));
  expect(mock.cancel).not.toHaveBeenCalled();
  await render({ isFocused: false });
  expect(mock.cancel).toHaveBeenCalledTimes(1);
  expect(mock.cancel.mock.calls[0][0]).toBe(mock.endRequest);
  await render({ isFocused: true });
  expect(mock.cancel).toHaveBeenCalledTimes(1);
  expect(mock.end).toHaveBeenCalledTimes(1);
  expect(frames).toHaveLength(0);
});
it('superseding navigation retires only the preceding accepted promise', async () => {
  const pending = new Promise<void>(() => {});
  await render({ isFocused: true });
  mock.end.mockReturnValueOnce(pending);
  await act(async () => ref.current!.scrollToEnd({ animated: false }));
  await act(async () => ref.current!.scrollToStart({ animated: false }));
  expect(mock.cancel).toHaveBeenCalledTimes(1);
  expect(mock.cancel.mock.calls[0][0]).toBe(mock.endRequest);
  expect(mock.offset).toHaveBeenCalledTimes(1);
});
it('settled promise is released before later route cover', async () => {
  const settled = Promise.resolve();
  await render({ isFocused: true });
  mock.end.mockReturnValueOnce(settled);
  await act(async () => ref.current!.scrollToEnd({ animated: false }));
  await render({ isFocused: false });
  expect(mock.cancel).not.toHaveBeenCalled();
});
