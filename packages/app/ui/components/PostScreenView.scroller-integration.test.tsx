import type * as db from '@tloncorp/shared/db';
import type {
  PostDataDraftEdit,
  PostDataDraftPost,
} from '@tloncorp/api/types/post';
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

import { PostScreenView } from './PostScreenView';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const state = vi.hoisted(() => ({
  active: true,
  navigationFocused: true,
  scrollIntentRevision: 0,
  liveUnread: { count: 1, notify: false },
  replies: new Map<string, db.Post[]>(),
  loading: false,
  showDeletes: false,
  unreadRequests: [] as {
    id: string;
    task: Deferred<db.ThreadUnreadState | null>;
  }[],
  getUnread: vi.fn(),
  markRead: vi.fn(),
  send: vi.fn(),
  commands: vi.fn(),
  navigateRef: vi.fn(),
  clearAttachments: vi.fn(),
  attachAssets: vi.fn(),
  drafts: { getDraft: vi.fn(), storeDraft: vi.fn(), clearDraft: vi.fn() },
  draftKeys: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => state.navigationFocused,
}));

vi.mock('@tloncorp/api', () => ({ ChannelContentConfiguration: {} }));
vi.mock('@tloncorp/api/urbit', () => ({ getChannelType: () => 'chat' }));
vi.mock('@tloncorp/shared', async () => ({
  ...(await vi.importActual('@tloncorp/api/types/PostCollectionConfiguration')),
  ...(await vi.importActual('@tloncorp/api/lib/types')),
  ...(await vi.importActual('../../../shared/src/store/unreadActivity')),
  DraftInputId: { gallery: 'gallery' },
  makePrettyDayAndTime: () => ({ asString: 'Today' }),
  useDebouncedValue: (value: unknown) => value,
}));
vi.mock('@tloncorp/shared/db', () => ({
  getThreadUnreadState: state.getUnread,
}));
vi.mock('@tloncorp/shared/store', () => ({
  usePostDraftCallbacks: (options: unknown) => {
    state.draftKeys(options);
    return state.drafts;
  },
  draftKeyFor: {
    thread: ({ parentPostId }: { parentPostId: string }) =>
      `thread:${parentPostId}`,
    postEdit: ({ postId }: { postId: string }) => `edit:${postId}`,
  },
  useLiveThreadUnreadByParentId: () => ({ data: state.liveUnread }),
  useThreadPosts: ({ postId }: { postId: string }) => ({
    data: state.replies.get(postId),
    isLoading: state.loading,
  }),
  useShowDeleteMarkers: () => ({ data: state.showDeletes }),
  markThreadRead: state.markRead,
  finalizeAndSendPost: state.send,
}));
vi.mock('@tloncorp/ui', () => ({ Carousel: 'Carousel' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34 }),
}));
vi.mock('tamagui', () => ({
  Text: 'Text',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
}));
vi.mock('../../hooks/useChannelNavigation', () => ({
  useChannelNavigation: () => ({ navigateToRef: state.navigateRef }),
}));
vi.mock('../../hooks/useUserActivity', () => ({
  useIsUserActive: () => state.active,
}));
vi.mock('../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~zod',
}));
vi.mock('../contexts/attachment', () => ({
  useAttachmentContext: () => ({
    attachAssets: state.attachAssets,
    clearAttachments: state.clearAttachments,
  }),
}));
vi.mock('../contexts/channel', () => ({ ChannelProvider: 'ChannelProvider' }));
vi.mock('../contexts/navigation', () => ({
  NavigationProvider: 'NavigationProvider',
}));
vi.mock('../contexts/scroll', () => ({
  ScrollContextProvider: 'ScrollContextProvider',
}));
vi.mock('../utils', () => ({
  useIsWindowNarrow: () => true,
  useIsAdmin: () => false,
  useCanWrite: () => true,
}));
vi.mock('./BareChatInput', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: function RetainedComposerBoundary(props: Record<string, unknown>) {
      // This probes the screen's mounted draft ownership, not native editing.
      const [draftText, setDraftText] = React.useState('');
      return React.createElement('ThreadComposerBoundary', {
        ...props,
        draftText,
        setDraftText,
      });
    },
  };
});
vi.mock('./BigInput', () => ({ BigInput: 'BigInput' }));
vi.mock('./Channel/ChannelHeader', () => ({
  ChannelHeader: 'ChannelHeader',
  ChannelHeaderItemsProvider: 'ChannelHeaderItemsProvider',
}));
vi.mock('./Channel/ContextLens', () => ({
  ContextLensPanel: 'ContextLensPanel',
  useContextLensController: () => ({ contextLensAvailable: false }),
}));
vi.mock('./Channel/DraftInputView', () => ({
  ConversationComposerPlacement: 'ConversationComposerPlacement',
  DraftInputView: 'DraftInputView',
}));
vi.mock('./FileDrop', () => ({ FileDrop: 'FileDrop' }));
vi.mock('./GroupPreviewSheet', () => ({
  GroupPreviewSheet: 'GroupPreviewSheet',
}));
vi.mock('./conversationScrollChrome', () => ({
  useConversationInsets: () => ({
    contentInsets: { top: 0, bottom: 80 },
    onFloatingHeightChange: vi.fn(),
  }),
}));
vi.mock('./draftInputs/shared', () => ({
  DraftInputContextProvider: 'DraftInputContextProvider',
}));
vi.mock('./DetailView', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    DetailView: (props: { post: db.Post; scrollerRef: React.Ref<unknown> }) => {
      // Record commands only; no synthetic scrolling policy or geometry.
      React.useImperativeHandle(
        props.scrollerRef,
        () => ({
          captureScrollIntent: () => {
            const revision = state.scrollIntentRevision;
            return () => revision === state.scrollIntentRevision;
          },
          scrollToEnd: (options: unknown) =>
            state.commands('end', props.post.id, options),
          scrollToPost: (options: unknown) =>
            state.commands('post', props.post.id, options),
          scrollToStart: (options: unknown) =>
            state.commands('start', props.post.id, options),
        }),
        [props.post.id]
      );
      return React.createElement('DetailBoundary', props);
    },
  };
});

const channel = (id = 'chat-a') =>
  ({ id, type: 'chat', title: 'Chat' }) as db.Channel;
const post = (id: string, extra: Partial<db.Post> = {}) =>
  ({
    id,
    channelId: 'chat-a',
    type: 'chat',
    authorId: '~ten',
    sentAt: 1,
    receivedAt: 1,
    replyCount: 1,
    ...extra,
  }) as db.Post;
const unread = (firstUnreadPostId: string) =>
  ({ count: 1, firstUnreadPostId }) as db.ThreadUnreadState;
type Props = React.ComponentProps<typeof PostScreenView>;
const replyDraft = (): PostDataDraftPost => ({
  channelId: 'chat-a',
  channelType: 'chat',
  content: ['hello'],
  attachments: [],
  replyToPostId: null,
  isEdit: false,
});

describe('native PostScreenView send read and navigation integration', () => {
  let renderer: ReactTestRenderer | undefined;
  let props: Props;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let previousAct: unknown;
  beforeAll(() => {
    previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
      .IS_REACT_ACT_ENVIRONMENT;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    if (previousAct === undefined)
      delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
        .IS_REACT_ACT_ENVIRONMENT;
    else Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: previousAct });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('__DEV__', false);
    state.active = true;
    state.navigationFocused = true;
    state.liveUnread = { count: 1, notify: false };
    state.loading = false;
    state.showDeletes = false;
    state.replies.clear();
    state.replies.set('parent-a', [post('reply-a', { parentId: 'parent-a' })]);
    state.replies.set('parent-b', [post('reply-b', { parentId: 'parent-b' })]);
    state.unreadRequests = [];
    state.getUnread.mockImplementation(({ parentId }: { parentId: string }) => {
      const task = deferred<db.ThreadUnreadState | null>();
      state.unreadRequests.push({ id: parentId, task });
      return task.promise;
    });
    state.send.mockResolvedValue(undefined);
    state.markRead.mockResolvedValue(undefined);
    frames = new Map();
    frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    props = {
      channel: channel(),
      parentPost: post('parent-a'),
      group: null,
      negotiationMatch: true,
      onPressDelete: vi.fn(),
      onGroupAction: vi.fn(),
      goToDm: vi.fn(),
      handleGoToUserProfile: vi.fn(),
      goBack: vi.fn(),
      setEditingPost: vi.fn(),
    };
  });
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const host = (name: string) =>
    renderer!.root.find((node) => (node.type as unknown) === name);
  const detail = () => host('DetailBoundary').props;
  const composer = () => host('ThreadComposerBoundary').props;
  async function render(next: Partial<Props> = {}) {
    props = { ...props, ...next };
    await act(async () => {
      const element = <PostScreenView {...props} />;
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  }
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  function flushFrame() {
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(16));
    });
  }
  async function resolveEntry(
    value: db.ThreadUnreadState | null,
    index = state.unreadRequests.length - 1
  ) {
    await act(async () => {
      state.unreadRequests[index].task.resolve(value);
    });
  }

  // These are production lifecycle/callback cases. Controlled native list,
  // database and transport boundaries do not establish visible native proof.
  it.each(
    [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ].map((order) => ({
      order,
      name: order.map((index) => ['old-A', 'B', 'new-A'][index]).join(' -> '),
    }))
  )(
    'PS-06 same-channel thread ABA preserves only current unread state: $name',
    async ({ order }) => {
      await render();
      await render({ parentPost: post('parent-b') });
      await render({ parentPost: post('parent-a') });
      expect(state.unreadRequests.map((request) => request.id)).toEqual([
        'parent-a',
        'parent-b',
        'parent-a',
      ]);
      const values = [
        unread('obsolete-a'),
        unread('obsolete-b'),
        unread('current-a'),
      ];
      let currentResolved = false;
      expect(detail().initialPostUnread).toBeNull();
      for (const index of order) {
        await resolveEntry(values[index], index);
        currentResolved ||= index === 2;
        expect(detail().initialPostUnread).toEqual(
          currentResolved ? values[2] : null
        );
      }
      expect(state.commands).not.toHaveBeenCalled();
    }
  );

  it('PS-07a original send completes for its target but cannot follow a new same-channel A visit', async () => {
    const task = deferred<void>();
    state.send.mockReturnValue(task.promise);
    await render();
    const draft = replyDraft();
    let pending!: Promise<void>;
    act(() => {
      pending = composer().sendPostFromDraft(draft);
    });
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send.mock.calls[0][0].replyToPostId).toBe('parent-a');
    await render({ parentPost: post('parent-b') });
    await render({ parentPost: post('parent-a') });
    await act(async () => {
      task.resolve();
      await pending;
    });
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it('PS-07b already queued send frame cannot follow a new same-channel A visit', async () => {
    await render();
    await act(async () => {
      await composer().sendPostFromDraft(replyDraft());
    });
    expect(frames.size).toBe(1);
    const oldFrame = [...frames.values()][0];
    // Simulate delivery already dequeued before cancellation; ownership must
    // still be checked inside the production callback itself.
    frames.clear();
    await render({ parentPost: post('parent-b') });
    await render({ parentPost: post('parent-a') });
    act(() => oldFrame(16));
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('PS-08 restored current-thread read eligibility gets a fresh full deadline', async () => {
    await render();
    advance(100);
    state.active = false;
    await render();
    state.active = true;
    await render();
    advance(50);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(99);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(1);
    expect(state.markRead.mock.calls).toEqual([
      [
        {
          channel: props.channel,
          parentPost: props.parentPost,
          post: state.replies.get('parent-a')![0],
        },
      ],
    ]);
  });

  it('PS-09 visible replacement thread becomes read eligible with its own full deadline', async () => {
    await render();
    await resolveEntry(unread('reply-a'));
    advance(100);
    await render({ parentPost: post('parent-b') });
    await resolveEntry(unread('reply-b'));
    // Keep the real screen's focus provider. A visible B that never becomes
    // eligible must fail rather than making stale-A cancellation look healthy.
    expect(detail().post.id).toBe('parent-b');
    expect(detail().posts.map((reply: db.Post) => reply.id)).toEqual([
      'reply-b',
    ]);
    expect(detail().initialPostUnread).toEqual(unread('reply-b'));
    advance(50);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(99);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(1);
    expect(state.markRead.mock.calls).toEqual([
      [
        {
          channel: props.channel,
          parentPost: props.parentPost,
          post: state.replies.get('parent-b')![0],
        },
      ],
    ]);
    advance(300);
    expect(state.markRead).toHaveBeenCalledTimes(1);
  });

  it.each(['old-first', 'new-first'])(
    'PS-01 replacement unread snapshot rejects old parent completion: %s',
    async (order) => {
      await render();
      await render({ parentPost: post('parent-b') });
      expect(state.unreadRequests.map((request) => request.id)).toEqual([
        'parent-a',
        'parent-b',
      ]);
      if (order === 'old-first') {
        await resolveEntry(unread('old-a'), 0);
        expect(detail().initialPostUnread).toBeNull();
      }
      await resolveEntry(unread('new-b'), 1);
      if (order === 'new-first') await resolveEntry(unread('old-a'), 0);
      expect(detail().initialPostUnread).toEqual(unread('new-b'));
    }
  );

  it('PS-01 old divider is cleared while replacement parent snapshot is pending', async () => {
    await render();
    await resolveEntry(unread('old-a'));
    await render({ parentPost: post('parent-b') });
    expect(detail().initialPostUnread).toBeNull();
  });

  it('PS-02 read waits 150ms and sends exact current channel parent and latest reply', async () => {
    await render();
    advance(149);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(1);
    expect(state.markRead.mock.calls).toEqual([
      [
        {
          channel: props.channel,
          parentPost: props.parentPost,
          post: state.replies.get('parent-a')![0],
        },
      ],
    ]);
    advance(300);
    expect(state.markRead).toHaveBeenCalledTimes(1);
  });

  it('PS-02 notification-only activity remains a valid read trigger', async () => {
    state.liveUnread = { count: 0, notify: true };
    await render();
    advance(150);
    expect(state.markRead).toHaveBeenCalledTimes(1);
  });

  it.each(['read-cleared', 'inactive', 'unmount', 'parent-replaced'])(
    'PS-02 obsolete read timer is cancelled by %s',
    async (event) => {
      await render();
      advance(100);
      if (event === 'read-cleared') {
        state.liveUnread = { count: 0, notify: false };
        await render();
      }
      if (event === 'inactive') {
        state.active = false;
        await render();
      }
      if (event === 'unmount') {
        act(() => renderer!.unmount());
        renderer = undefined;
      }
      if (event === 'parent-replaced')
        await render({ parentPost: post('parent-b') });
      advance(200);
      expect(state.markRead).not.toHaveBeenCalled();
    }
  );

  it('PS-02 newer reply restarts the timer and reads only the newest actual reply', async () => {
    await render();
    advance(100);
    const latest = post('reply-a2', { parentId: 'parent-a' });
    state.replies.set('parent-a', [latest, ...state.replies.get('parent-a')!]);
    await render();
    advance(149);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(1);
    expect(state.markRead.mock.calls).toEqual([
      [{ channel: props.channel, parentPost: props.parentPost, post: latest }],
    ]);
  });

  it('PS-02 empty thread cannot fabricate a read acknowledgement', async () => {
    state.replies.set('parent-a', []);
    await render();
    advance(500);
    expect(state.markRead).not.toHaveBeenCalled();
  });

  it('PS-03 reply sends to current parent once and scrolls on the next frame only after completion', async () => {
    const task = deferred<void>();
    state.send.mockReturnValue(task.promise);
    await render();
    const draft = replyDraft();
    const options = { rejectOnDefinitiveFailure: true };
    let pending!: Promise<void>;
    act(() => {
      pending = composer().sendPostFromDraft(draft, options);
    });
    expect(props.setEditingPost).toHaveBeenCalledWith(undefined);
    expect(state.send.mock.calls).toEqual([
      [{ ...draft, replyToPostId: 'parent-a' }, options],
    ]);
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
    await act(async () => {
      task.resolve();
      await pending;
    });
    expect(state.commands).not.toHaveBeenCalled();
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', 'parent-a', { animated: true }],
    ]);
  });

  it('covering the retained route blocks old and newly arriving unread work until a fresh focused interval', async () => {
    await render();
    advance(100);
    state.navigationFocused = false;
    await render();
    advance(200);
    expect(state.markRead).not.toHaveBeenCalled();

    const incoming = post('reply-covered', { parentId: 'parent-a' });
    state.replies.set('parent-a', [incoming]);
    state.liveUnread = { count: 2, notify: true };
    await render();
    advance(200);
    expect(state.markRead).not.toHaveBeenCalled();

    state.navigationFocused = true;
    await render();
    advance(149);
    expect(state.markRead).not.toHaveBeenCalled();
    advance(1);
    expect(state.markRead.mock.calls).toEqual([
      [
        {
          channel: props.channel,
          parentPost: props.parentPost,
          post: incoming,
        },
      ],
    ]);
    advance(300);
    expect(state.markRead).toHaveBeenCalledTimes(1);
  });

  it.each(['while-covered', 'after-return'])(
    'covering the route permanently retires pending send-follow completed %s',
    async (completion) => {
      const task = deferred<void>();
      state.send.mockReturnValue(task.promise);
      await render();
      let pending!: Promise<void>;
      act(() => {
        pending = composer().sendPostFromDraft(replyDraft());
      });
      expect(state.send).toHaveBeenCalledTimes(1);
      state.navigationFocused = false;
      await render();
      if (completion === 'after-return') {
        state.navigationFocused = true;
        await render();
      }
      await act(async () => {
        task.resolve();
        await pending;
      });
      flushFrame();
      expect(state.commands).not.toHaveBeenCalled();
      if (completion === 'while-covered') {
        state.navigationFocused = true;
        await render();
        flushFrame();
      }
      expect(state.commands).not.toHaveBeenCalled();
      expect(state.send).toHaveBeenCalledTimes(1);
    }
  );

  it('an already dequeued send frame cannot scroll after route cover and return', async () => {
    await render();
    await act(async () => {
      await composer().sendPostFromDraft(replyDraft());
    });
    expect(frames.size).toBe(1);
    const oldFrame = [...frames.values()][0];
    frames.clear();
    state.navigationFocused = false;
    await render();
    state.navigationFocused = true;
    await render();
    act(() => oldFrame(16));
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('route cover and return retain the draft owner while only a fresh visible send may dispatch', async () => {
    await render();
    const originalComposer = host('ThreadComposerBoundary');
    const oldSend = composer().sendPostFromDraft;
    act(() => composer().setDraftText('Retained reply draft'));
    state.navigationFocused = false;
    await render();
    expect(host('ThreadComposerBoundary')).toBe(originalComposer);
    expect(composer().draftText).toBe('Retained reply draft');
    expect(detail().isFocused).toBe(false);
    await act(async () => {
      await composer().sendPostFromDraft(replyDraft());
    });
    expect(state.send).not.toHaveBeenCalled();

    state.navigationFocused = true;
    await render();
    expect(host('ThreadComposerBoundary')).toBe(originalComposer);
    expect(composer().draftText).toBe('Retained reply draft');
    expect(detail().isFocused).toBe(true);
    expect(state.drafts.clearDraft).not.toHaveBeenCalled();
    await act(async () => {
      await oldSend(replyDraft());
    });
    expect(state.send).not.toHaveBeenCalled();
    const draft = { ...replyDraft(), content: ['Retained reply draft'] };
    await act(async () => {
      await composer().sendPostFromDraft(draft);
    });
    expect(state.send.mock.calls).toEqual([
      [{ ...draft, replyToPostId: 'parent-a' }, undefined],
    ]);
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', 'parent-a', { animated: true }],
    ]);
  });

  it('a focused Send after idle still dispatches and follows while read acknowledgement remains ineligible', async () => {
    state.active = false;
    await render();
    await act(async () => {
      await composer().sendPostFromDraft(replyDraft());
    });
    expect(state.send).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(state.commands.mock.calls).toEqual([
      ['end', 'parent-a', { animated: true }],
    ]);
    advance(200);
    expect(state.markRead).not.toHaveBeenCalled();
  });

  it.each(['before-completion', 'after-frame-queued'])(
    'a user READ intent retires reply send-follow %s',
    async (boundary) => {
      const task = deferred<void>();
      state.send.mockReturnValue(task.promise);
      await render();
      let pending!: Promise<void>;
      act(() => {
        pending = composer().sendPostFromDraft(replyDraft());
      });
      if (boundary === 'before-completion') state.scrollIntentRevision += 1;
      await act(async () => {
        task.resolve();
        await pending;
      });
      if (boundary === 'after-frame-queued') {
        expect(frames.size).toBe(1);
        state.scrollIntentRevision += 1;
      }
      flushFrame();
      expect(state.send).toHaveBeenCalledTimes(1);
      expect(state.commands).not.toHaveBeenCalled();
    }
  );

  it('PS-03 editing retains original reply target and does not issue send-follow scroll', async () => {
    await render();
    const draft: PostDataDraftEdit = {
      ...replyDraft(),
      isEdit: true,
      editTargetPostId: 'reply-a',
      replyToPostId: 'original-parent',
    };
    await act(async () => {
      await composer().sendPostFromDraft(draft);
    });
    expect(state.send.mock.calls).toEqual([[draft, undefined]]);
    expect(draft.replyToPostId).toBe('original-parent');
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('PS-03 failed send cannot produce a successful scroll', async () => {
    state.send.mockRejectedValue(new Error('offline'));
    await render();
    await act(async () => {
      await expect(composer().sendPostFromDraft(replyDraft())).rejects.toThrow(
        'offline'
      );
    });
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it.each(['parent-replaced', 'unmount'])(
    'PS-03 old send completion cannot scroll after %s',
    async (event) => {
      const task = deferred<void>();
      state.send.mockReturnValue(task.promise);
      await render();
      let pending!: Promise<void>;
      act(() => {
        pending = composer().sendPostFromDraft(replyDraft());
      });
      if (event === 'parent-replaced')
        await render({ parentPost: post('parent-b') });
      else {
        act(() => renderer!.unmount());
        renderer = undefined;
      }
      await act(async () => {
        task.resolve();
        await pending;
      });
      flushFrame();
      expect(state.commands).not.toHaveBeenCalled();
    }
  );

  it('PS-03 completed send frame cannot follow a replacement thread', async () => {
    await render();
    await act(async () => {
      await composer().sendPostFromDraft(replyDraft());
    });
    await render({ parentPost: post('parent-b') });
    flushFrame();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it.each(['parent', 'loaded-reply'])(
    'PS-04 %s reference scrolls once to the exact same-thread target',
    async (kind) => {
      await render();
      const target =
        kind === 'parent'
          ? props.parentPost!
          : state.replies.get('parent-a')![0];
      act(() =>
        host('NavigationProvider').props.onPressRef(props.channel, target)
      );
      expect(state.commands.mock.calls).toEqual([
        [
          'post',
          'parent-a',
          { postId: target.id, animated: true, viewPosition: 0.5 },
        ],
      ]);
      expect(detail().highlightPostId).toBe(target.id);
      expect(state.navigateRef).not.toHaveBeenCalled();
    }
  );

  it.each(['missing', 'other-thread', 'other-channel'])(
    'PS-04 %s reference uses exact external navigation destination',
    async (kind) => {
      await render();
      const destination =
        kind === 'other-channel' ? channel('chat-b') : props.channel;
      const target = post('external', {
        parentId: kind === 'other-thread' ? 'parent-b' : 'parent-a',
      });
      act(() =>
        host('NavigationProvider').props.onPressRef(destination, target)
      );
      expect(state.navigateRef.mock.calls).toEqual([[destination, target]]);
      expect(state.commands).not.toHaveBeenCalled();
    }
  );

  it('PS-05 replacement selected highlight gets its own full lifetime', async () => {
    await render({ selectedPostId: 'reply-a' });
    advance(1_000);
    await render({ selectedPostId: 'reply-a2' });
    expect(detail().anchor).toEqual({ type: 'selected', postId: 'reply-a2' });
    advance(4_999);
    expect(detail().highlightPostId).toBe('reply-a2');
    advance(1);
    expect(detail().highlightPostId).toBeNull();
    expect(state.commands).not.toHaveBeenCalled();
  });

  it('PS-05 selected reply becoming hidden clears both anchor and highlight', async () => {
    await render({ selectedPostId: 'reply-a' });
    state.replies.set('parent-a', [
      post('reply-a', { parentId: 'parent-a', isDeleted: true }),
    ]);
    await render();
    expect(detail().anchor).toBeNull();
    expect(detail().highlightPostId).toBeNull();
  });

  it('PS-05 leaving clears thread attachments once before navigation', async () => {
    const events: string[] = [];
    state.clearAttachments.mockImplementation(() => events.push('clear'));
    await render({ goBack: vi.fn(() => events.push('back')) });
    act(() => host('ChannelHeader').props.goBack());
    expect(events).toEqual(['clear', 'back']);
    expect(state.clearAttachments).toHaveBeenCalledTimes(1);
    expect(props.goBack).toHaveBeenCalledTimes(1);
  });
});
