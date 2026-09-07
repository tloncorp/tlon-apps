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

import ChannelScreen from './ChannelScreen';

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
  focused: true,
  focusListeners: new Set<() => void>(),
  channels: new Map<string, db.Channel>(),
  unreadRequests: [] as {
    id: string;
    task: Deferred<db.ChannelUnread | null>;
  }[],
  queryInputs: vi.fn(),
  getUnread: vi.fn(),
  getPost: vi.fn(),
  markRead: vi.fn(),
  sync: vi.fn(),
  loadOlder: vi.fn(),
  loadNewer: vi.fn(),
  retrySend: vi.fn(),
  editPost: vi.fn(),
  deletePost: vi.fn(),
  deleteFailed: vi.fn(),
  upsertDm: vi.fn(),
  navigate: vi.fn(),
  push: vi.fn(),
  setParams: vi.fn(),
  routeNavigation: vi.fn(),
  liveCursor: null as db.Post | null,
  showDeletes: false,
  loading: false,
  posts: [] as db.Post[],
  query: {
    isFetching: false,
    hasNextPage: false,
    hasPreviousPage: false,
    isError: false,
    error: null as Error | null,
    data: undefined as { pages: { posts: db.Post[] }[] } | undefined,
    refetch: vi.fn(),
  },
  drafts: { getDraft: vi.fn(), storeDraft: vi.fn(), clearDraft: vi.fn() },
}));

vi.mock('@react-navigation/native', async () => {
  const { useEffect, useSyncExternalStore } =
    await vi.importActual<typeof import('react')>('react');
  const useIsFocused = () =>
    useSyncExternalStore(
      (listener) => {
        state.focusListeners.add(listener);
        return () => {
          state.focusListeners.delete(listener);
        };
      },
      () => state.focused
    );
  return {
    useIsFocused,
    // Preserve focus effect subscription/cleanup semantics. The screen's real
    // effect callback and abort/stale-promise handling remain under test.
    useFocusEffect: (callback: () => void | (() => void)) => {
      const focused = useIsFocused();
      useEffect(() => (focused ? callback() : undefined), [callback, focused]);
    },
  };
});
vi.mock('@tloncorp/api', () => ({
  getCurrentUserId: () => '~zod',
  onActivityCapabilitiesChange: () => () => {},
  getActivityCapabilitiesEpoch: () => 0,
}));
vi.mock('@tloncorp/shared', async () => ({
  ...(await vi.importActual('@tloncorp/api/types/PostCollectionConfiguration')),
  createDevLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    trackError: vi.fn(),
    sensitiveCrumb: vi.fn(),
  }),
  useChannelContext: ({ channelId }: { channelId: string }) => ({
    channel: state.channels.get(channelId),
    group: null,
    groupIsLoading: false,
    negotiationStatus: { matchedOrPending: true },
    ...state.drafts,
    editingPost: undefined,
    setEditingPost: vi.fn(),
  }),
}));
vi.mock('@tloncorp/shared/db', () => ({
  getChannelUnread: state.getUnread,
  getPost: state.getPost,
  lastVisitedChannelId: () => ({ setValue: vi.fn() }),
}));
vi.mock('@tloncorp/shared/store', () => ({
  markChannelVisited: vi.fn(),
  markPotentialWayfindingChannelVisit: vi.fn(),
  markGroupVisited: vi.fn(),
  syncChannelThreadUnreads: state.sync,
  SyncPriority: { High: 'high' },
  useShowDeleteMarkers: () => ({ data: state.showDeletes }),
  usePostWithRelations: () => ({ data: state.liveCursor }),
  useChannelPosts: (options: unknown) => {
    state.queryInputs(options);
    return {
      posts: state.posts,
      query: state.query,
      loadOlder: state.loadOlder,
      loadNewer: state.loadNewer,
      isLoading: state.loading,
    };
  },
  useCanUpload: () => true,
  markChannelRead: state.markRead,
  retrySendPost: state.retrySend,
  editPost: state.editPost,
  deletePost: state.deletePost,
  deleteFailedPost: state.deleteFailed,
  upsertDmChannel: state.upsertDm,
  uploadAsset: vi.fn(),
}));
vi.mock('../../hooks/useChannelNavigation', () => ({
  useChannelNavigation: () => ({
    navigateToImage: state.routeNavigation,
    navigateToPost: state.routeNavigation,
    navigateToRef: state.routeNavigation,
    navigateToSearch: state.routeNavigation,
    navigateToContextLensRuns: state.routeNavigation,
    navigateToContextLensRun: state.routeNavigation,
  }),
}));
vi.mock('../../hooks/useChatSettingsNavigation', () => ({
  useChatSettingsNavigation: () => ({}),
}));
vi.mock('../../hooks/useGroupActions', () => ({
  useGroupActions: () => ({ performGroupAction: vi.fn() }),
}));
vi.mock('../../hooks/useHandleLogout', () => ({
  useHandleLogout: () => vi.fn(),
}));
vi.mock('../../hooks/usePushNotifTapTelemetry', () => ({
  usePushNotifTapTelemetry: vi.fn(),
}));
vi.mock('../../hooks/useResetDb', () => ({ useResetDb: () => vi.fn() }));
vi.mock('../../navigation/utils', () => ({
  useRootNavigation: () => ({ navigation: { navigate: state.navigate } }),
}));
vi.mock('../../ui', () => ({
  AttachmentProvider: 'AttachmentProvider',
  ChatOptionsProvider: 'ChatOptionsProvider',
  Channel: 'ChannelBoundary',
  InviteUsersSheet: 'InviteUsersSheet',
  useIsWindowNarrow: () => true,
}));
vi.mock('../../ui/components/Channel/postVisibility', () => ({
  isAgentGroupSetupActive: () => false,
}));
vi.mock('./useAgentOnboardingChannel', () => ({
  useAgentOnboardingChannel: () => ({
    agentOnboarding: {},
    agentShipId: undefined,
    navigationLocked: false,
  }),
}));
vi.mock('./useAgentOnboardingFirstEntry', () => ({
  useAgentOnboardingFirstEntry: () => undefined,
}));

const channel = (id = 'a', extra: Partial<db.Channel> = {}) =>
  ({ id, type: 'chat', groupId: 'group-a', ...extra }) as db.Channel;
const post = (id: string, extra: Partial<db.Post> = {}) =>
  ({
    id,
    authorId: '~ten',
    channelId: 'a',
    type: 'chat',
    receivedAt: 1,
    sentAt: 1,
    ...extra,
  }) as db.Post;
const unread = (id = 'unread-a') =>
  ({
    channelId: 'a',
    count: 2,
    countWithoutThreads: 2,
    firstUnreadPostId: id,
  }) as db.ChannelUnread;
type Props = React.ComponentProps<typeof ChannelScreen>;

describe('native ChannelScreen query and callback integration', () => {
  let renderer: ReactTestRenderer | undefined;
  let props: Props;
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
    vi.stubGlobal('__DEV__', false);
    state.focused = true;
    state.focusListeners.clear();
    state.channels.clear();
    state.channels.set('a', channel());
    state.channels.set('b', channel('b', { groupId: 'group-b' }));
    state.unreadRequests = [];
    state.getUnread.mockImplementation(
      ({ channelId }: { channelId: string }) => {
        const task = deferred<db.ChannelUnread | null>();
        state.unreadRequests.push({ id: channelId, task });
        return task.promise;
      }
    );
    state.sync.mockResolvedValue(undefined);
    state.markRead.mockResolvedValue(undefined);
    state.retrySend.mockResolvedValue(undefined);
    state.editPost.mockResolvedValue(undefined);
    state.deletePost.mockResolvedValue(undefined);
    state.showDeletes = false;
    state.liveCursor = null;
    state.loading = false;
    state.posts = Array.from({ length: 25 }, (_, i) => post(`post-${i}`));
    state.query = {
      isFetching: false,
      hasNextPage: false,
      hasPreviousPage: false,
      isError: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    };
    props = {
      route: { params: { channelId: 'a' } },
      navigation: {
        setParams: state.setParams,
        navigate: state.navigate,
        push: state.push,
        goBack: vi.fn(),
      },
    } as unknown as Props;
  });
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    vi.unstubAllGlobals();
  });
  const channels = () =>
    renderer!.root.findAll(
      (node) => (node.type as unknown) === 'ChannelBoundary'
    );
  const ui = () => channels()[0].props;
  const query = () => state.queryInputs.mock.calls.at(-1)![0];
  async function render(params: Partial<Props['route']['params']> = {}) {
    props = {
      ...props,
      route: { ...props.route, params: { ...props.route.params, ...params } },
    };
    await act(async () => {
      const element = <ChannelScreen {...props} />;
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  }
  async function resolveEntry(
    value: db.ChannelUnread | null = unread(),
    index = state.unreadRequests.length - 1
  ) {
    await act(async () => {
      state.unreadRequests[index].task.resolve(value);
    });
  }
  function focus(value: boolean) {
    act(() => {
      state.focused = value;
      state.focusListeners.forEach((listener) => listener());
    });
  }

  // These cases observe production screen lifecycle/query arguments. The
  // Channel surface is controlled; no rendered native positioning is inferred.
  it('CS-09 obsolete latest callback cannot retire a subsequently selected target', async () => {
    await render({ selectedPostId: 'selected-a' });
    await resolveEntry();
    const oldLatest = ui().onPressScrollToBottom;
    await render({ selectedPostId: 'selected-b' });
    act(() => oldLatest());
    expect(query()).toMatchObject({
      mode: 'around',
      cursorPostId: 'selected-b',
    });
    expect(ui().selectedPostId).toBe('selected-b');
    expect(state.setParams).not.toHaveBeenCalled();
  });

  it('CS-10a fresh focused entry cannot revive the prior visit read callback', async () => {
    await render();
    await resolveEntry();
    const oldRead = ui().markRead;
    focus(false);
    focus(true);
    expect(query().enabled).toBe(false);
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
    await act(async () => {
      await oldRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
    await resolveEntry(unread('fresh-visit'));
    expect(query().enabled).toBe(true);
    await act(async () => {
      await oldRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead.mock.calls).toEqual([
      [{ id: 'a', groupId: 'group-a' }],
    ]);
  });

  it('CS-10b pending then resolved channel cannot revive the revoked read callback', async () => {
    await render();
    await resolveEntry();
    const oldRead = ui().markRead;
    state.channels.set('a', channel('a', { isPendingChannel: true }));
    await render();
    expect(query().enabled).toBe(false);
    state.channels.set('a', channel('a', { isPendingChannel: false }));
    await render();
    expect(query().enabled).toBe(true);
    await act(async () => {
      await oldRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead.mock.calls).toEqual([
      [{ id: 'a', groupId: 'group-a' }],
    ]);
  });

  it('CS-10c channel ABA accepts only the new initialized visit read callback', async () => {
    await render();
    await resolveEntry();
    const oldRead = ui().markRead;
    await render({ channelId: 'b' });
    await resolveEntry({ ...unread('unread-b'), channelId: 'b' });
    await render({ channelId: 'a' });
    await resolveEntry(unread('fresh-a'));
    expect(query()).toMatchObject({ enabled: true, cursorPostId: 'fresh-a' });
    await act(async () => {
      await oldRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead.mock.calls).toEqual([
      [{ id: 'a', groupId: 'group-a' }],
    ]);
  });

  it('CS-01 does not mount cached channel posts or enable its query before unread initialization', async () => {
    await render();
    expect(channels()).toHaveLength(0);
    expect(query()).toMatchObject({ enabled: false, channelId: 'a' });
    expect(state.markRead).not.toHaveBeenCalled();
    await resolveEntry();
    expect(channels()).toHaveLength(1);
    expect(query()).toMatchObject({
      enabled: true,
      mode: 'around',
      cursorPostId: 'unread-a',
      firstPageCount: 30,
    });
    expect(ui().initialChannelUnread).toEqual(unread());
  });

  it('CS-02 latest retires selected and unread cursors even while the new page is loading', async () => {
    state.loading = true;
    await render({ selectedPostId: 'selected-a' });
    await resolveEntry();
    expect(query()).toMatchObject({
      mode: 'around',
      cursorPostId: 'selected-a',
    });
    act(() => ui().onPressScrollToBottom());
    expect(state.setParams.mock.calls).toEqual([
      [{ selectedPostId: undefined }],
    ]);
    expect(query()).toMatchObject({ mode: 'newest', firstPageCount: 50 });
    expect(query()).not.toHaveProperty('cursorPostId');
    expect(ui().initialChannelUnread).toBeUndefined();
    expect(ui().selectedPostId).toBeUndefined();
    await render({ selectedPostId: undefined });
    expect(query().mode).toBe('newest');
    expect(state.markRead).not.toHaveBeenCalled();
  });

  it('CS-02 latest from unreads selects newest without unrelated navigation writes', async () => {
    await render();
    await resolveEntry();
    act(() => ui().onPressScrollToBottom());
    expect(query().mode).toBe('newest');
    expect(state.setParams).not.toHaveBeenCalled();
  });

  it('CS-03 a new selected target establishes a new around cursor after latest', async () => {
    await render();
    await resolveEntry();
    act(() => ui().onPressScrollToBottom());
    await render({ selectedPostId: 'selected-b' });
    expect(query()).toMatchObject({
      mode: 'around',
      cursorPostId: 'selected-b',
    });
  });

  it('CS-03 focused reentry retains draft surface while disabling reads until its fresh snapshot', async () => {
    await render();
    await resolveEntry();
    const instance = channels()[0];
    act(() => ui().onPressScrollToBottom());
    focus(false);
    focus(true);
    expect(channels()[0]).toBe(instance);
    expect(ui().getDraft).toBe(state.drafts.getDraft);
    expect(query()).toMatchObject({ enabled: false, mode: 'newest' });
    act(() => {
      void ui().markRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
    await resolveEntry(unread('second-visit'));
    expect(query()).toMatchObject({
      enabled: true,
      mode: 'around',
      cursorPostId: 'second-visit',
    });
  });

  it.each(['old-first', 'new-first'])(
    'CS-04 ignores old channel snapshot in completion order %s',
    async (order) => {
      await render();
      await render({ channelId: 'b' });
      expect(state.unreadRequests.map((request) => request.id)).toEqual([
        'a',
        'b',
      ]);
      const newUnread = { ...unread('unread-b'), channelId: 'b' };
      if (order === 'old-first') {
        await resolveEntry(unread(), 0);
        expect(channels()).toHaveLength(0);
      }
      await resolveEntry(newUnread, 1);
      if (order === 'new-first') await resolveEntry(unread(), 0);
      expect(query()).toMatchObject({
        channelId: 'b',
        enabled: true,
        cursorPostId: 'unread-b',
      });
      expect(ui().initialChannelUnread).toEqual(newUnread);
    }
  );

  it('CS-04 an unfocused snapshot cannot initialize the next focused entry', async () => {
    await render();
    focus(false);
    await resolveEntry();
    expect(channels()).toHaveLength(0);
    focus(true);
    expect(query().enabled).toBe(false);
    await resolveEntry(unread('fresh'));
    expect(query().cursorPostId).toBe('fresh');
  });

  it('CS-04 A -> B -> A rejects the first A visit snapshot', async () => {
    await render();
    await render({ channelId: 'b' });
    await render({ channelId: 'a' });
    await resolveEntry(unread('obsolete'), 0);
    expect(channels()).toHaveLength(0);
    await resolveEntry(unread('current'), 2);
    await resolveEntry({ ...unread('b'), channelId: 'b' }, 1);
    expect(query().cursorPostId).toBe('current');
  });

  it('CS-04 rejected unread read recovers with a scoped newest query', async () => {
    await render();
    await act(async () => {
      state.unreadRequests[0].task.reject(new Error('local read failed'));
    });
    expect(query()).toMatchObject({
      channelId: 'a',
      enabled: true,
      mode: 'newest',
    });
    expect(ui().initialChannelUnread).toBeNull();
  });

  it('CS-05 current initialized mark-read sends exact channel and group', async () => {
    await render();
    await resolveEntry();
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead.mock.calls).toEqual([
      [{ id: 'a', groupId: 'group-a' }],
    ]);
  });

  it('CS-05 unfocused current callback cannot mark the channel read', async () => {
    await render();
    await resolveEntry();
    focus(false);
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
  });

  it.each(['switch', 'blur', 'unmount'])(
    'CS-05 captured initialized callback cannot mark read after %s',
    async (event) => {
      await render();
      await resolveEntry();
      const oldRead = ui().markRead;
      if (event === 'switch') await render({ channelId: 'b' });
      if (event === 'blur') focus(false);
      if (event === 'unmount') {
        act(() => renderer!.unmount());
        renderer = undefined;
      }
      await act(async () => {
        await oldRead();
      });
      expect(state.markRead).not.toHaveBeenCalled();
    }
  );

  it('CS-05 a channel becoming pending revokes its mark-read callback', async () => {
    await render();
    await resolveEntry();
    state.channels.set('a', channel('a', { isPendingChannel: true }));
    await render();
    expect(query().enabled).toBe(false);
    await act(async () => {
      await ui().markRead();
    });
    expect(state.markRead).not.toHaveBeenCalled();
  });

  it('CS-06 failed unread around query falls back to newest after loading ends', async () => {
    state.query.isError = true;
    state.loading = true;
    await render();
    await resolveEntry();
    expect(query().mode).toBe('around');
    state.loading = false;
    await render();
    expect(query().mode).toBe('newest');
  });

  it('CS-06 explicit selected query failure retains its target for target recovery', async () => {
    state.query.isError = true;
    await render({ selectedPostId: 'selected-a' });
    await resolveEntry();
    expect(query()).toMatchObject({
      mode: 'around',
      cursorPostId: 'selected-a',
    });
  });

  it('CS-06 hidden selected post retires its anchor and route selection', async () => {
    state.liveCursor = post('hidden', { isDeleted: true });
    await render({ selectedPostId: 'hidden' });
    await resolveEntry();
    expect(query().mode).toBe('newest');
    expect(ui().selectedPostId).toBeUndefined();
    expect(state.setParams).toHaveBeenCalledWith({ selectedPostId: undefined });
  });

  it('CS-06 sparse history requests older data only after entry becomes eligible', async () => {
    state.posts = [post('one')];
    state.query.hasNextPage = true;
    await render();
    expect(state.loadOlder).not.toHaveBeenCalled();
    await resolveEntry();
    expect(state.loadOlder).toHaveBeenCalledTimes(1);
    expect(ui().onLoadOlderPosts).toBe(state.loadOlder);
    expect(ui().onLoadNewerPosts).toBe(state.loadNewer);
  });

  it('CS-07 aborts previous sync request on channel replacement and disposal', async () => {
    await render();
    const firstSignal = state.sync.mock.calls[0][1].abortSignal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);
    await render({ channelId: 'b' });
    expect(firstSignal.aborted).toBe(true);
    const secondSignal = state.sync.mock.calls.at(-1)![1]
      .abortSignal as AbortSignal;
    expect(state.sync.mock.calls.at(-1)![0]).toBe('b');
    expect(secondSignal.aborted).toBe(false);
    act(() => renderer!.unmount());
    renderer = undefined;
    expect(secondSignal.aborted).toBe(true);
  });

  it('CS-08 failed send retry uses the exact current channel and post', async () => {
    await render();
    await resolveEntry();
    const failed = post('failed', { deliveryStatus: 'failed' });
    await act(async () => {
      await ui().onPressRetrySend(failed);
    });
    expect(state.retrySend.mock.calls).toEqual([
      [{ channel: state.channels.get('a'), post: failed }],
    ]);
    expect(state.editPost).not.toHaveBeenCalled();
  });

  it('CS-08 failed edit retry keeps persisted body, parent, title and image', async () => {
    await render();
    await resolveEntry();
    const content = [{ inline: ['persisted'] }];
    state.getPost.mockResolvedValue({
      lastEditContent: JSON.stringify(content),
    });
    const failed = post('edit', {
      editStatus: 'failed',
      lastEditContent: 'stale',
      lastEditTitle: 'Title',
      lastEditImage: 'image',
      parentId: 'parent',
    });
    await act(async () => {
      await ui().onPressRetrySend(failed);
    });
    expect(state.getPost.mock.calls).toEqual([[{ postId: 'edit' }]]);
    expect(state.editPost.mock.calls).toEqual([
      [
        {
          post: failed,
          content,
          parentId: 'parent',
          metadata: { title: 'Title', image: 'image' },
        },
      ],
    ]);
  });

  it('CS-08 failed delete retry preserves the exact failed post', async () => {
    await render();
    await resolveEntry();
    const failed = post('deleted', { deleteStatus: 'failed' });
    await act(async () => {
      await ui().onPressRetrySend(failed);
    });
    expect(state.deletePost.mock.calls).toEqual([[{ post: failed }]]);
    expect(state.retrySend).not.toHaveBeenCalled();
    expect(state.editPost).not.toHaveBeenCalled();
  });

  it('CS-08 current DM completion navigates exactly once to the returned channel', async () => {
    state.upsertDm.mockResolvedValue(channel('dm/~ten'));
    await render();
    await resolveEntry();
    await act(async () => {
      await ui().goToDm(['~ten']);
    });
    expect(state.push.mock.calls).toEqual([['DM', { channelId: 'dm/~ten' }]]);
  });

  it('CS-08 failed DM creation cannot navigate to a fabricated destination', async () => {
    state.upsertDm.mockRejectedValue(new Error('offline'));
    await render();
    await resolveEntry();
    await act(async () => {
      await expect(ui().goToDm(['~ten'])).rejects.toThrow('offline');
    });
    expect(state.push).not.toHaveBeenCalled();
  });

  it.each(['switch', 'unmount'])(
    'CS-08 old DM completion cannot navigate after %s',
    async (event) => {
      const task = deferred<db.Channel>();
      state.upsertDm.mockReturnValue(task.promise);
      await render();
      await resolveEntry();
      let pending!: Promise<void>;
      act(() => {
        pending = ui().goToDm(['~ten']);
      });
      expect(state.upsertDm.mock.calls).toEqual([[{ participants: ['~ten'] }]]);
      if (event === 'switch') await render({ channelId: 'b' });
      else {
        act(() => renderer!.unmount());
        renderer = undefined;
      }
      await act(async () => {
        task.resolve(channel('dm/~ten'));
        await pending;
      });
      expect(state.push).not.toHaveBeenCalled();
    }
  );
});
