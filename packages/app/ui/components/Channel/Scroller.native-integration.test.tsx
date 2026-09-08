import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { DetailView, DetailViewProps } from '../DetailView';
import Scroller from './Scroller';
import { ScrollerItem } from './ScrollerItem';
import type { PostTargetLayoutRegistry } from './postTargetLayout';
import type { PostListMethods } from './PostList/shared';
import { ListPostCollection } from '../postCollectionViews/ListPostCollectionView';
import { ThinkingState } from './ThinkingState';
import type { ConversationComputingState } from './useConversationComputingState';

// The subject is the real Scroller/DetailView/ThinkingState React lifecycle.
// PostList is a native boundary adapter: it records imperative commands and
// exposes production callbacks, without implementing scroll or ready policy.
const state = vi.hoisted(() => ({
  glass: false,
  collection: null as any,
  commands: vi.fn(),
  composer: vi.fn(),
  computing: new Map<string, ConversationComputingState>(),
  presenceListeners: new Set<() => void>(),
  deliverInitialLayout: false,
  layoutLifecycle: vi.fn(),
}));

vi.mock('@tloncorp/shared', async () => ({
  ...(await vi.importActual('@tloncorp/api/types/PostCollectionConfiguration')),
  ...(await vi.importActual('@tloncorp/api/lib/types')),
  createDevLogger: () => ({ log: vi.fn() }),
}));
vi.mock('@tloncorp/shared/db', () => ({
  debugMessageJson: { useStorageItem: () => ({ value: false }) },
}));
vi.mock('@tloncorp/shared/store', () => ({ editPost: vi.fn() }));
vi.mock('@tloncorp/shared/logic', () => ({ isSameDay: () => true }));
vi.mock('@tloncorp/ui', () => ({
  DESKTOP_SIDEBAR_WIDTH: 0,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH: 0,
  LoadingSpinner: 'LoadingSpinner',
  Button: 'Button',
  Modal: 'Modal',
  Text: 'Text',
  useIsWindowNarrow: () => true,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '26.0' },
  View: 'RNView',
  useWindowDimensions: () => ({ width: 402, height: 874 }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('tamagui', () => ({
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  Spinner: 'Spinner',
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
  styled: (component: unknown) => component,
  getTokens: () => ({
    space: { s: { val: 8 }, m: { val: 12 }, l: { val: 16 } },
  }),
  getTokenValue: () => 12,
  useStyle: (style: unknown) => style,
  useTheme: () => ({ background: { val: '#fff' } }),
}));
vi.mock('../../../hooks/useLivePost', () => ({
  useLivePost: (post: db.Post) => post,
}));
vi.mock('../../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~zod',
}));
vi.mock('../../contexts/scroll', () => ({
  useSetConversationScrollToBottomControl: () => state.composer,
}));
vi.mock('../../hooks/useOnEmojiSelect', () => ({ default: () => vi.fn() }));
vi.mock('../ChatMessage/ChatMessageActions/Component', () => ({
  ChatMessageActions: 'ChatMessageActions',
}));
vi.mock('../ChatMessage/ViewReactionsSheet', () => ({
  ViewReactionsSheet: 'ViewReactionsSheet',
}));
vi.mock('../ChatMessage/a2uiActionCompletion', () => ({
  getA2UIActionCompletions: () => [],
}));
vi.mock('../Emoji', () => ({ EmojiPickerSheet: 'EmojiPickerSheet' }));
vi.mock('../GlassSurface', () => ({ supportsLiquidGlass: () => state.glass }));
vi.mock('../conversationScrollChrome', () => ({
  ConversationScrollToBottomButton: 'LatestControl',
}));
vi.mock('../../contexts/postCollection', () => ({
  usePostCollectionContext: () => state.collection,
}));
vi.mock('./EmptyChannelNotice', () => ({
  EmptyChannelNotice: 'EmptyChannelNotice',
}));
vi.mock('./ChannelDivider', () => ({ ChannelDivider: 'ChannelDivider' }));
vi.mock('./ContextLens/ContextLensRunSheet', () => ({
  ContextLensRunSheet: 'ContextLensRunSheet',
}));
vi.mock('./postVisibility', () => ({ isVisibleChannelPost: () => true }));
vi.mock('../Avatar', () => ({ ContactAvatar: 'ContactAvatar' }));
vi.mock('../ChatMessage', () => ({ ChatMessage: 'ChatMessage' }));
vi.mock('../GalleryPost/GalleryPost', () => ({
  GalleryPostDetailView: 'GalleryPostDetailView',
}));
vi.mock('../NotebookPost/NotebookPost', () => ({
  NotebookPostDetailView: 'NotebookPostDetailView',
}));
vi.mock('./useShouldShowThinkingState', () => ({
  useShouldShowThinkingState: () => true,
}));
vi.mock('./useConversationComputingState', async () => {
  const { useSyncExternalStore } =
    await vi.importActual<typeof import('react')>('react');
  return {
    // A real subscription boundary matters: DetailView intentionally memoizes
    // the footer element while the newest post stays unchanged. Presence must
    // still notify ThinkingState independently of a parent prop render.
    useConversationComputingState: (scope: string) =>
      useSyncExternalStore(
        (listener) => {
          state.presenceListeners.add(listener);
          return () => {
            state.presenceListeners.delete(listener);
          };
        },
        () => state.computing.get(scope) ?? null
      ),
  };
});
vi.mock('./PostList', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    PostList: React.forwardRef(function NativePostListBoundary(
      props: any,
      ref
    ) {
      const initialCallbacks = React.useRef<BoundaryProps>(props);
      React.useImperativeHandle(
        ref,
        () => ({
          scrollToEnd: (options: unknown) =>
            state.commands('end', props.channel.id, options),
          scrollToStart: (options: unknown) =>
            state.commands('start', props.channel.id, options),
          scrollToPost: (options: unknown) =>
            state.commands('post', props.channel.id, options),
        }),
        [props.channel.id]
      );
      React.useLayoutEffect(() => {
        if (!state.deliverInitialLayout) return;
        state.layoutLifecycle('setup');
        // Deliveries occur during real child layout, before parent layout.
        // The adapter supplies events; Scroller alone owns their policy.
        initialCallbacks.current.onStartReached();
        initialCallbacks.current.onEndReached();
        initialCallbacks.current.onInitialScrollCompleted();
        return () => state.layoutLifecycle('cleanup');
      }, []);
      return React.createElement(
        'PostListBoundary',
        props,
        props.postsWithNeighbors.map((item: any, index: number) =>
          React.createElement(
            React.Fragment,
            { key: item.post.id },
            props.renderItem({ item, index })
          )
        ),
        props.listBottomComponent
      );
    }),
  };
});

type ScrollerProps = React.ComponentProps<typeof Scroller>;
type BoundaryProps = {
  targetLayouts?: PostTargetLayoutRegistry;
  anchor?: ScrollerProps['anchor'];
  onStartReached: () => void;
  onEndReached: () => void;
  onInitialScrollPending: () => void;
  onInitialScrollCompleted: () => void;
  onInitialScrollRecoveryChange: (
    recovery: { retry: () => void } | null
  ) => void;
  onScrolledAwayFromBottom: () => void;
  onScrolledToBottom: () => void;
  onScrollIntentChanged: () => void;
  postsWithNeighbors: { post: db.Post }[];
  contentInsets: { top: number; bottom: number };
  contentContainerStyle: Record<string, unknown>;
  scrollEnabled: boolean;
};

const channel = (id = 'chat/~zod/a') => ({ id, type: 'chat' }) as db.Channel;
const post = (id: string, authorId = '~ten', channelId = 'chat/~zod/a') =>
  ({
    id,
    authorId,
    channelId,
    type: 'chat',
    sentAt: 1,
    receivedAt: 1,
    replyCount: 0,
    isDeleted: false,
  }) as db.Post;
const presence = (): ConversationComputingState => ({
  ships: [{ ship: '~bot', label: 'Thinking...', toolCalls: [] }],
  label: 'Thinking...',
  toolCalls: [],
});
const permutations = <T,>(a: T, b: T, c: T): T[][] => [
  [a, b, c],
  [a, c, b],
  [b, a, c],
  [b, c, a],
  [c, a, b],
  [c, b, a],
];

describe('native Scroller production integration', () => {
  let renderer: ReactTestRenderer | undefined;
  let props: ScrollerProps;
  let detailProps: DetailViewProps;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let originalActEnvironment: unknown;

  beforeAll(() => {
    originalActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    if (originalActEnvironment === undefined)
      delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    else
      Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: originalActEnvironment,
      });
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.glass = false;
    state.computing.clear();
    state.presenceListeners.clear();
    state.deliverInitialLayout = false;
    frames = new Map();
    frameId = 0;
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    props = {
      channel: channel(),
      posts: [post('first'), post('last')],
      collectionLayoutType: 'compact-list-bottom-to-top',
      anchorToEnd: true,
      renderItem: 'Message' as any,
      activeMessage: null,
      setActiveMessage: vi.fn(),
      onPressDelete: vi.fn(),
      onStartReached: vi.fn(),
      onEndReached: vi.fn(),
      onPressScrollToBottom: vi.fn(),
    };
    detailProps = {
      channel: channel(),
      post: post('parent'),
      posts: [post('reply-2'), post('reply-1')],
      activeMessage: null,
      setActiveMessage: vi.fn(),
      onPressDelete: vi.fn(),
    };
  });
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const list = () =>
    renderer!.root.findByType('PostListBoundary' as any).props as BoundaryProps;
  const button = () => renderer!.root.findByType('LatestControl' as any).props;
  const footer = () =>
    renderer!.root.findByType(ThinkingState).findByType('View' as any);
  const unreadDividers = () =>
    renderer!.root
      .findAllByType('ChannelDivider' as any)
      .filter((node) => node.props.unreadCount > 0);
  async function render(next: Partial<ScrollerProps> = {}) {
    props = { ...props, ...next };
    await act(async () => {
      const element = <Scroller {...props} />;
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  }
  async function renderDetail(next: Partial<DetailViewProps> = {}) {
    detailProps = { ...detailProps, ...next };
    await act(async () => {
      const element = <DetailView {...detailProps} />;
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  }
  const emit = (
    event: keyof Pick<
      BoundaryProps,
      | 'onStartReached'
      | 'onEndReached'
      | 'onInitialScrollPending'
      | 'onInitialScrollCompleted'
      | 'onScrolledAwayFromBottom'
      | 'onScrolledToBottom'
      | 'onScrollIntentChanged'
    >
  ) => act(() => list()[event]());
  function flushFrame() {
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(16));
    });
  }

  it('shares one scoped decoration registry with non-recycled chat rows', async () => {
    await render();
    const registry = list().targetLayouts;
    expect(registry?.scope).toBe(props.channel.id);
    const rows = renderer!.root.findAllByType(ScrollerItem);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.props.targetLayouts).toBe(registry);
    await render({ posts: [...props.posts!] });
    expect(list().targetLayouts).toBe(registry);
  });

  it('keeps recycled non-chat DetailView comments on their existing targeting path', async () => {
    await renderDetail({ channel: { ...channel(), type: 'notebook' } });
    expect(list().targetLayouts).toBeUndefined();
    const rows = renderer!.root.findAllByType(ScrollerItem);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.props.targetLayouts).toBeUndefined();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('removes the registry on an anchorToEnd change without replacing the mounted list', async () => {
    await render();
    const mounted = renderer!.root.findByType('PostListBoundary' as any);
    expect(list().targetLayouts).toBeDefined();
    await render({ anchorToEnd: false });
    expect(renderer!.root.findByType('PostListBoundary' as any)).toBe(mounted);
    expect(list().targetLayouts).toBeUndefined();
    for (const row of renderer!.root.findAllByType(ScrollerItem))
      expect(row.props.targetLayouts).toBeUndefined();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('initial position error exposes retry without readiness, pagination flush or remount', async () => {
    await render();
    const mounted = renderer!.root.findByType('PostListBoundary' as any);
    const retry = vi.fn();
    act(() => {
      list().onStartReached();
      list().onEndReached();
      list().onInitialScrollRecoveryChange({ retry });
    });
    expect(renderer!.root.findAllByType('LoadingSpinner' as any)).toHaveLength(
      0
    );
    const retryButton = renderer!.root
      .findAllByType('Button' as any)
      .find((node) => node.props.label === 'Try again');
    expect(retryButton).toBeTruthy();
    act(() => retryButton!.props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
    expect(props.onStartReached).not.toHaveBeenCalled();
    expect(props.onEndReached).not.toHaveBeenCalled();
    expect(renderer!.root.findByType('PostListBoundary' as any)).toBe(mounted);
    act(() => list().onInitialScrollCompleted());
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    expect(props.onEndReached).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findAllByType('Button' as any)).toHaveLength(0);
  });
  it('old entry error cannot replace current scope recovery', async () => {
    await render();
    const old = list().onInitialScrollRecoveryChange;
    await render({
      channel: channel('chat/~zod/b'),
      posts: [post('new', '~ten', 'chat/~zod/b')],
    });
    const currentRetry = vi.fn();
    const oldRetry = vi.fn();
    act(() => list().onInitialScrollRecoveryChange({ retry: currentRetry }));
    act(() => old({ retry: oldRetry }));
    const button = renderer!.root
      .findAllByType('Button' as any)
      .find((node) => node.props.label === 'Try again');
    act(() => button!.props.onPress());
    expect(currentRetry).toHaveBeenCalledTimes(1);
    expect(oldRetry).not.toHaveBeenCalled();
  });
  it('NINT-15 child layout pagination survives parent activation', async () => {
    state.deliverInitialLayout = true;
    await render();
    expect(state.layoutLifecycle.mock.calls).toEqual([['setup']]);
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    expect(props.onEndReached).toHaveBeenCalledTimes(1);
    emit('onInitialScrollCompleted');
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    expect(props.onEndReached).toHaveBeenCalledTimes(1);
  });

  it('NINT-16 verified Strict Mode cleanup and restart retains only current pagination', async () => {
    state.deliverInitialLayout = true;
    await act(async () => {
      renderer = create(
        <React.StrictMode>
          <Scroller {...props} />
        </React.StrictMode>
      );
    });
    // Qualify actual effect replay; wrapping in StrictMode alone is not proof.
    expect(state.layoutLifecycle.mock.calls).toEqual([
      ['setup'],
      ['cleanup'],
      ['setup'],
    ]);
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    expect(props.onEndReached).toHaveBeenCalledTimes(1);
    emit('onInitialScrollCompleted');
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    expect(props.onEndReached).toHaveBeenCalledTimes(1);
  });

  it('NINT-17 pagination drain preserves a distinct reentrant boundary exactly once', async () => {
    const chronology: string[] = [];
    let reentered = false;
    await render({
      onStartReached: vi.fn(() => chronology.push('start')),
      onEndReached: vi.fn(() => {
        chronology.push('end');
        if (!reentered) {
          reentered = true;
          list().onEndReached();
        }
      }),
    });
    emit('onStartReached');
    emit('onEndReached');
    expect(chronology).toEqual([]);
    emit('onInitialScrollCompleted');
    expect(chronology).toEqual(['end', 'end', 'start']);
    expect(props.onEndReached).toHaveBeenCalledTimes(2);
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    emit('onInitialScrollCompleted');
    expect(chronology).toEqual(['end', 'end', 'start']);
  });

  it.each(
    permutations('start', 'end', 'ready').map((order) => ({
      order,
      name: order.join(' -> '),
    }))
  )(
    'NINT-01 flushes each pagination direction once: $name',
    async ({ order }) => {
      await render();
      for (const event of order) {
        emit(
          event === 'ready'
            ? 'onInitialScrollCompleted'
            : event === 'start'
              ? 'onStartReached'
              : 'onEndReached'
        );
        if (!order.slice(0, order.indexOf(event) + 1).includes('ready')) {
          expect(props.onStartReached).not.toHaveBeenCalled();
          expect(props.onEndReached).not.toHaveBeenCalled();
        }
      }
      expect(props.onStartReached).toHaveBeenCalledTimes(1);
      expect(props.onEndReached).toHaveBeenCalledTimes(1);
    }
  );

  it('NINT-01 coalesces repeated pending boundaries and dispatches later current boundaries', async () => {
    await render();
    emit('onStartReached');
    emit('onStartReached');
    emit('onEndReached');
    emit('onEndReached');
    expect(props.onStartReached).not.toHaveBeenCalled();
    expect(props.onEndReached).not.toHaveBeenCalled();
    emit('onInitialScrollCompleted');
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
    expect(props.onEndReached).toHaveBeenCalledTimes(1);
    emit('onStartReached');
    emit('onEndReached');
    expect(props.onStartReached).toHaveBeenCalledTimes(2);
    expect(props.onEndReached).toHaveBeenCalledTimes(2);
  });

  it.each(['channel', 'selected', 'unread'] as const)(
    'NINT-02 discards pending work on %s scope replacement',
    async (kind) => {
      await render();
      emit('onStartReached');
      emit('onEndReached');
      await render(
        kind === 'channel'
          ? { channel: channel('chat/~zod/b') }
          : { anchor: { type: kind, postId: 'last' } }
      );
      emit('onInitialScrollCompleted');
      expect(props.onStartReached).not.toHaveBeenCalled();
      expect(props.onEndReached).not.toHaveBeenCalled();
      emit('onStartReached');
      expect(props.onStartReached).toHaveBeenCalledTimes(1);
    }
  );

  it('NINT-03 old readiness before new readiness does not reveal the replacement', async () => {
    await render();
    const oldReady = list().onInitialScrollCompleted;
    await render({ channel: channel('chat/~zod/b') });
    emit('onScrolledAwayFromBottom');
    emit('onStartReached');
    act(oldReady);
    expect(button().visible).toBe(false);
    expect(props.onStartReached).not.toHaveBeenCalled();
    emit('onInitialScrollCompleted');
    expect(button().visible).toBe(true);
    expect(props.onStartReached).toHaveBeenCalledTimes(1);
  });

  it.each(['onStartReached', 'onEndReached'] as const)(
    'NINT-02 captured %s cannot request an old scope after replacement',
    async (event) => {
      await render();
      emit('onInitialScrollCompleted');
      const oldBoundary = list()[event];
      const oldStart = props.onStartReached;
      const oldEnd = props.onEndReached;
      await render({
        channel: channel('chat/~zod/b'),
        onStartReached: vi.fn(),
        onEndReached: vi.fn(),
      });
      act(oldBoundary);
      expect(oldStart).not.toHaveBeenCalled();
      expect(oldEnd).not.toHaveBeenCalled();
      expect(props.onStartReached).not.toHaveBeenCalled();
      expect(props.onEndReached).not.toHaveBeenCalled();
    }
  );

  it('NINT-02 captured pagination cannot dispatch after disposal', async () => {
    await render();
    emit('onInitialScrollCompleted');
    const oldEnd = list().onEndReached;
    act(() => renderer!.unmount());
    renderer = undefined;
    act(oldEnd);
    expect(props.onEndReached).not.toHaveBeenCalled();
  });

  it('NINT-03 old readiness after new readiness does not hide ready replacement content', async () => {
    await render();
    const oldReady = list().onInitialScrollCompleted;
    await render({ channel: channel('chat/~zod/b') });
    emit('onScrolledAwayFromBottom');
    emit('onInitialScrollCompleted');
    expect(button().visible).toBe(true);
    act(oldReady);
    expect(button().visible).toBe(true);
  });

  it('NINT-03 an old pending callback cannot revoke the current scope readiness', async () => {
    await render();
    const oldPending = list().onInitialScrollPending;
    await render({ channel: channel('chat/~zod/b') });
    emit('onScrolledAwayFromBottom');
    emit('onInitialScrollCompleted');
    act(oldPending);
    expect(button().visible).toBe(true);
  });

  it('NINT-03 repeated scope key does not accept the previous visit readiness (ABA)', async () => {
    await render();
    const firstVisitReady = list().onInitialScrollCompleted;
    await render({ channel: channel('chat/~zod/b') });
    await render({ channel: channel() });
    emit('onScrolledAwayFromBottom');
    emit('onStartReached');
    act(firstVisitReady);
    expect(button().visible).toBe(false);
    expect(props.onStartReached).not.toHaveBeenCalled();
  });

  it('NINT-03 a completed A visit is not reused as readiness after A -> B -> A', async () => {
    await render();
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    await render({ channel: channel('chat/~zod/b') });
    expect(button().visible).toBe(false);
    await render({ channel: channel() });
    expect(button().visible).toBe(false);
  });

  it.each(['covered', 'returned'])(
    'retained route blur permanently cancels pending latest completed while %s',
    async (completion) => {
      await render({ isFocused: true, isLoading: true, hasNewerPosts: true });
      emit('onInitialScrollCompleted');
      emit('onScrolledAwayFromBottom');
      act(() => button().onPress());
      flushFrame();
      const mounted = renderer!.root.findByType('PostListBoundary' as any);
      await render({ isFocused: false });
      if (completion === 'returned') await render({ isFocused: true });
      await render({ isLoading: false, hasNewerPosts: false });
      flushFrame();
      expect(state.commands).not.toHaveBeenCalled();
      if (completion === 'covered') await render({ isFocused: true });
      flushFrame();
      expect(state.commands).not.toHaveBeenCalled();
      expect(renderer!.root.findByType('PostListBoundary' as any)).toBe(
        mounted
      );
      expect(props.onPressScrollToBottom).toHaveBeenCalledTimes(1);
      act(() => button().onPress());
      flushFrame();
      expect(state.commands.mock.calls).toEqual([
        ['end', channel().id, { animated: true }],
      ]);
    }
  );

  it('forced old latest RAF and old press cannot steal a fresh request after route focus ABA', async () => {
    await render({ isFocused: true });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    const oldPress = button().onPress;
    act(oldPress);
    const oldFrame = [...frames.values()][0];
    frames.clear();
    await render({ isFocused: false });
    await render({ isFocused: true });
    act(oldPress);
    expect(props.onPressScrollToBottom).toHaveBeenCalledTimes(1);
    act(() => button().onPress());
    act(() => oldFrame(16));
    expect(state.commands).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', channel().id, { animated: true }],
    ]);
  });

  it('DetailView forwards focus without replacing the list and Scroller captures a unique visible visit', async () => {
    const ref = React.createRef<PostListMethods>();
    await renderDetail({ isFocused: true, scrollerRef: ref });
    emit('onInitialScrollCompleted');
    const mounted = renderer!.root.findByType('PostListBoundary' as any);
    const oldPermit = ref.current!.captureScrollIntent!();
    expect(oldPermit()).toBe(true);
    await renderDetail({ isFocused: false });
    expect((list() as any).isFocused).toBe(false);
    expect(oldPermit()).toBe(false);
    expect(ref.current!.captureScrollIntent!()()).toBe(false);
    act(() => ref.current!.scrollToEnd({ animated: true }));
    expect(state.commands).not.toHaveBeenCalled();
    await renderDetail({ isFocused: true });
    expect(oldPermit()).toBe(false);
    expect(ref.current!.captureScrollIntent!()()).toBe(true);
    expect(renderer!.root.findByType('PostListBoundary' as any)).toBe(mounted);
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
    act(() => ref.current!.scrollToEnd({ animated: true }));
    expect(state.commands).toHaveBeenCalledTimes(1);
  });

  it('real ListPostCollection forwards context focus and cancels pending latest without remount', async () => {
    state.collection = {
      channel: channel(),
      posts: [post('last'), post('first')],
      isFocused: true,
      isLoadingPosts: true,
      hasNewerPosts: true,
      LegacyPostView: 'Message',
      onPressDelete: vi.fn(),
      onPressRetryLoad: vi.fn(),
      scrollToBottom: vi.fn(),
    };
    const updateCollection = async () => {
      await act(async () => {
        const element = <ListPostCollection />;
        if (renderer) renderer.update(element);
        else renderer = create(element);
      });
    };
    await updateCollection();
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    flushFrame();
    const mounted = renderer!.root.findByType('PostListBoundary' as any);
    state.collection = { ...state.collection, isFocused: false };
    await updateCollection();
    expect((list() as any).isFocused).toBe(false);
    state.collection = {
      ...state.collection,
      isLoadingPosts: false,
      hasNewerPosts: false,
    };
    await updateCollection();
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
    state.collection = { ...state.collection, isFocused: true };
    await updateCollection();
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
    expect(renderer!.root.findByType('PostListBoundary' as any)).toBe(mounted);
    act(() => button().onPress());
    flushFrame();
    expect(state.commands).toHaveBeenCalledTimes(1);
  });

  it('NINT-04 cached latest calls the real supplied action before one next-frame end command', async () => {
    const chronology: string[] = [];
    await render({
      onPressScrollToBottom: vi.fn(() => chronology.push('caller')),
    });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    expect(props.onPressScrollToBottom).toHaveBeenCalledTimes(1);
    expect(chronology).toEqual(['caller']);
    expect(state.commands).not.toHaveBeenCalled();
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', channel().id, { animated: true }],
    ]);
  });

  it('NINT-04 loading latest dispatches the supplied request but does not issue a premature end command', async () => {
    await render({ isLoading: true, hasNewerPosts: true });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    expect(button().loading).toBe(false);
    act(() => button().onPress());
    expect(button().loading).toBe(true);
    expect(props.onPressScrollToBottom).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('NINT-04 repeated activation retains one caller invocation per actual press', async () => {
    await render({ isLoading: true, hasNewerPosts: true });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    act(() => button().onPress());
    expect(props.onPressScrollToBottom).toHaveBeenCalledTimes(2);
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('NINT-05 deferred latest cannot scroll a replacement channel', async () => {
    await render();
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    await render({ channel: channel('chat/~zod/b') });
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('NINT-05 deferred latest cannot scroll after disposal', async () => {
    await render();
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    act(() => renderer!.unmount());
    renderer = undefined;
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('pending latest is immediately cancelled by a newer reading intent', async () => {
    await render({ isLoading: true, hasNewerPosts: true });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    expect(button().loading).toBe(true);
    emit('onScrollIntentChanged');
    expect(button().loading).toBe(false);
    await render({ isLoading: false, hasNewerPosts: false });
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('a cancelled frame cannot consume a newer latest request', async () => {
    await render();
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    const oldFrame = [...frames.values()][0];
    expect(oldFrame).toBeTypeOf('function');
    emit('onScrollIntentChanged');
    act(() => button().onPress());
    expect(frames.size).toBe(1);
    act(() => oldFrame(16));
    expect(state.commands).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', channel().id, { animated: true }],
    ]);
  });

  it('an old selected visit cannot activate latest for its replacement', async () => {
    await render({ anchor: { type: 'selected', postId: 'first' } });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    const oldPress = button().onPress;
    await render({ anchor: { type: 'selected', postId: 'last' } });
    emit('onInitialScrollCompleted');
    act(oldPress);
    flushFrame();
    expect(props.onPressScrollToBottom).not.toHaveBeenCalled();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('an old bottom callback cannot hide the replacement visit control', async () => {
    await render({ anchor: { type: 'selected', postId: 'first' } });
    const oldBottom = list().onScrolledToBottom;
    await render({ anchor: { type: 'selected', postId: 'last' } });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(oldBottom);
    expect(button().visible).toBe(true);
  });

  it('NINT-06 readiness, unread removal and bottom transitions do not steal scroll ownership', async () => {
    await render({ firstUnreadId: 'last', unreadCount: 3 });
    emit('onScrolledAwayFromBottom');
    expect(button().visible).toBe(false);
    emit('onInitialScrollCompleted');
    expect(button().visible).toBe(true);
    await render({ unreadCount: 0, firstUnreadId: null });
    expect(button().visible).toBe(true);
    expect(state.commands).not.toHaveBeenCalled();
    emit('onScrolledToBottom');
    expect(button().visible).toBe(false);
  });

  it('NINT-06 prior-scope latest press cannot turn replacement background loading into a pressed spinner', async () => {
    await render({ isLoading: true, hasNewerPosts: true });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    expect(button().loading).toBe(true);
    await render({ channel: channel('chat/~zod/b') });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    expect(button().loading).toBe(false);
  });

  it.each([
    { collectionLayoutType: 'grid' },
    { collectionLayoutType: 'comfy-list-top-to-bottom' },
    { anchorToEnd: false },
  ])(
    'NINT-06 unsupported end-follow surface stays hidden for %j',
    async (overrides) => {
      await render(overrides as Partial<ScrollerProps>);
      emit('onInitialScrollCompleted');
      emit('onScrolledAwayFromBottom');
      expect(button().visible).toBe(false);
    }
  );

  it('NINT-07 composer owner receives current control and clears on disposal', async () => {
    state.glass = true;
    await render({ contentInsets: { top: 20, bottom: 80 }, isLoading: true });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    expect(renderer!.root.findAllByType('LatestControl' as any)).toHaveLength(
      0
    );
    const control = () => state.composer.mock.calls.at(-1)![0];
    expect(control()).toMatchObject({ visible: true, isLoading: false });
    act(() => control().onPress());
    expect(control()).toMatchObject({ visible: true, isLoading: true });
    expect(props.onPressScrollToBottom).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
    renderer = undefined;
    expect(control()).toBeNull();
  });

  it('NINT-07 moving out of composer placement clears that owner and creates one list control', async () => {
    state.glass = true;
    await render({ contentInsets: { top: 0, bottom: 80 } });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    await render({ contentInsets: { top: 0, bottom: 0 } });
    expect(state.composer.mock.calls.at(-1)![0]).toBeNull();
    expect(renderer!.root.findAllByType('LatestControl' as any)).toHaveLength(
      1
    );
    expect(button().visible).toBe(true);
  });

  it('NINT-08 empty iOS content reserves the composer inset once and clamps short frames', async () => {
    await render({ posts: [], contentInsets: { top: 20, bottom: 80 } });
    const frame = renderer!.root
      .findAllByType('View' as any)
      .find((node) => node.props.onLayout)!;
    act(() =>
      frame.props.onLayout({ nativeEvent: { layout: { height: 500 } } })
    );
    expect(list().contentInsets).toEqual({ top: 20, bottom: 80 });
    expect(list().contentContainerStyle).toMatchObject({
      minHeight: 420,
      paddingTop: 20,
    });
    expect(list().contentContainerStyle.paddingBottom ?? 0).toBe(0);
    await render({ contentInsets: { top: 20, bottom: 540 } });
    expect(list().contentContainerStyle.minHeight).toBe(0);
    await render({ posts: [post('first')] });
    expect(list().contentContainerStyle.paddingBottom).toBe(0);
    expect(list().contentContainerStyle.minHeight).toBeUndefined();
  });

  it('NINT-09 real thread ordering and unread row change without scrolling', async () => {
    await renderDetail({
      initialPostUnread: {
        count: 2,
        firstUnreadPostId: 'reply-1',
      } as db.ThreadUnreadState,
    });
    expect(list().postsWithNeighbors.map(({ post }) => post.id)).toEqual([
      'parent',
      'reply-1',
      'reply-2',
    ]);
    expect(unreadDividers().map((node) => node.props.post.id)).toEqual([
      'reply-1',
    ]);
    await renderDetail({
      initialPostUnread: {
        count: 1,
        firstUnreadPostId: 'reply-2',
      } as db.ThreadUnreadState,
    });
    expect(unreadDividers().map((node) => node.props.post.id)).toEqual([
      'reply-2',
    ]);
    await renderDetail({
      initialPostUnread: {
        count: 0,
        firstUnreadPostId: 'reply-2',
      } as db.ThreadUnreadState,
    });
    expect(unreadDividers()).toHaveLength(0);
    expect(state.commands).not.toHaveBeenCalled();
  });

  it.each(
    permutations('end', 'bot', 'other').map((order) => ({
      order,
      name: order.join(' -> '),
    }))
  )(
    'NINT-10 thread thinking handoff preserves its footer: $name',
    async ({ order }) => {
      state.computing.set(channel().id, presence());
      await renderDetail({ posts: [] });
      const instance = renderer!.root.findByType(ThinkingState);
      expect(footer().props.height).toBe(52);
      const replies: db.Post[] = [];
      let ended = false;
      let botArrived = false;
      for (const event of order) {
        if (event === 'end') {
          ended = true;
          act(() => {
            state.computing.delete(channel().id);
            state.presenceListeners.forEach((listener) => listener());
          });
        } else {
          botArrived ||= event === 'bot';
          replies.unshift(
            post(`reply-${event}`, event === 'bot' ? '~bot' : '~other')
          );
        }
        await renderDetail({ posts: [...replies] });
        expect(renderer!.root.findByType(ThinkingState)).toBe(instance);
        expect(footer().props.height).toBe(ended && botArrived ? 0 : 52);
      }
      await act(async () => {
        vi.advanceTimersByTime(2_100);
      });
      expect(footer().props.height).toBe(0);
      expect(state.commands).not.toHaveBeenCalled();
    }
  );

  it('NINT-11 changing conversation during thinking grace cannot retain the old footer state', async () => {
    state.computing.set(channel().id, presence());
    await renderDetail({ posts: [] });
    act(() => {
      state.computing.delete(channel().id);
      state.presenceListeners.forEach((listener) => listener());
    });
    await renderDetail({ posts: [] });
    expect(footer().props.height).toBe(52);
    await renderDetail({
      channel: channel('chat/~zod/b'),
      post: post('new-parent', '~ten', 'chat/~zod/b'),
      posts: [],
    });
    expect(footer().props.height).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(2_100);
    });
    expect(footer().props.height).toBe(0);
  });

  it('NINT-12 selected and unread rows stay distinct while editing toggles list interaction', async () => {
    await render({
      anchor: { type: 'selected', postId: 'first' },
      firstUnreadId: 'last',
      unreadCount: 1,
    });
    const messages = () => renderer!.root.findAllByType('Message' as any);
    expect(
      messages()
        .filter((node) => node.props.isHighlighted)
        .map((node) => node.props.post.id)
    ).toEqual(['first']);
    expect(unreadDividers().map((node) => node.props.post.id)).toEqual([
      'last',
    ]);
    await render({ editingPost: post('first') });
    expect(list().scrollEnabled).toBe(false);
    await render({ editingPost: undefined });
    expect(list().scrollEnabled).toBe(true);
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('row action changes reach an unchanged message', async () => {
    const oldDelete = vi.fn();
    const currentDelete = vi.fn();
    await render({ onPressDelete: oldDelete });
    await render({ onPressDelete: currentDelete });
    const message = renderer!.root.findAllByType('Message' as any)[0];
    act(() => message.props.onPressDelete(message.props.post));
    expect(oldDelete).not.toHaveBeenCalled();
    expect(currentDelete.mock.calls).toEqual([[message.props.post]]);
  });

  it('a replacement renderer reaches unchanged rows', async () => {
    await render();
    await render({
      renderItem: (props) => React.createElement('ReplacementMessage', props),
    });
    expect(renderer!.root.findAllByType('Message' as any)).toHaveLength(0);
    expect(
      renderer!.root.findAllByType('ReplacementMessage' as any)
    ).toHaveLength(2);
  });

  it('NINT-12 imperative navigation forwards exact parameters to the current native list', async () => {
    const ref = React.createRef<any>();
    await render({ ref } as any);
    act(() =>
      ref.current.scrollToPost({
        postId: 'first',
        animated: false,
        viewPosition: 0.35,
      })
    );
    act(() => ref.current.scrollToStart({ animated: true }));
    act(() => ref.current.scrollToEnd({ animated: false }));
    expect(state.commands.mock.calls).toEqual([
      [
        'post',
        channel().id,
        { postId: 'first', animated: false, viewPosition: 0.35 },
      ],
      ['start', channel().id, { animated: true }],
      ['end', channel().id, { animated: false }],
    ]);
  });

  // Lifecycle integration only: this caller adapter changes external inputs;
  // it does not implement readiness, follow policy or native list geometry.
  it('NINT-13a latest survives its own cursor clear while synchronous loading blocks the old cached frame', async () => {
    const caller = vi.fn(() => {
      props = { ...props, anchor: null, isLoading: true, hasNewerPosts: true };
      renderer!.update(<Scroller {...props} />);
    });
    await render({
      anchor: { type: 'selected', postId: 'first' },
      isLoading: false,
      onPressScrollToBottom: caller,
    });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    expect(caller).toHaveBeenCalledTimes(1);
    expect(list().anchor).toBeNull();
    expect(button().loading).toBe(true);
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
    await render({ isLoading: false, hasNewerPosts: false });
    emit('onInitialScrollCompleted');
    emit('onScrolledToBottom');
    expect(button().visible).toBe(false);
    expect(button().loading).toBe(false);
  });

  it('NINT-13b cached latest retains its command across its own selected cursor retirement', async () => {
    const caller = vi.fn(() => {
      props = { ...props, anchor: null };
      renderer!.update(<Scroller {...props} />);
    });
    await render({
      anchor: { type: 'selected', postId: 'first' },
      isLoading: false,
      onPressScrollToBottom: caller,
    });
    emit('onInitialScrollCompleted');
    emit('onScrolledAwayFromBottom');
    act(() => button().onPress());
    expect(caller).toHaveBeenCalledTimes(1);
    expect(list().anchor).toBeNull();
    expect(state.commands).not.toHaveBeenCalled();
    emit('onInitialScrollCompleted');
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', channel().id, { animated: true }],
    ]);
    flushFrame();
    expect(state.commands).toHaveBeenCalledTimes(1);
  });

  it('NINT-14 same-channel thread ABA cannot inherit an old thinking grace state', async () => {
    state.computing.set(channel().id, presence());
    await renderDetail({ post: post('parent-a'), posts: [] });
    act(() => {
      state.computing.delete(channel().id);
      state.presenceListeners.forEach((listener) => listener());
    });
    await renderDetail();
    expect(footer().props.height).toBe(52);
    await renderDetail({ post: post('parent-b'), posts: [] });
    expect(detailProps.channel.id).toBe(channel().id);
    expect(footer().props.height).toBe(0);
    await renderDetail({ post: post('parent-a'), posts: [] });
    expect(footer().props.height).toBe(0);
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    expect(footer().props.height).toBe(0);
    expect(state.commands).not.toHaveBeenCalled();
  });
});
