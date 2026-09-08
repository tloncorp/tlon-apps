import React from 'react';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type * as db from '@tloncorp/shared/db';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostScreen from './PostScreen';

const state = vi.hoisted(() => ({
  focused: true,
  canGoBack: true,
  queries: new Map<
    string,
    {
      data: db.Post | null | undefined;
      isLoading: boolean;
      isFetched: boolean;
      isError?: boolean;
      refetch: ReturnType<typeof vi.fn>;
    }
  >(),
  channel: { id: 'channel', type: 'chat' } as db.Channel | null,
  sync: vi.fn(),
  back: vi.fn(),
  reset: vi.fn(),
  viewMounts: 0,
  viewUnmounts: 0,
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  // Observe the original rejection so pre-fix controls can all finish. This
  // does not replace/resolve the promise returned to the real screen: its
  // visible error and retry behavior are still independently asserted.
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}
vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => state.focused,
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { PostOpened: 'PostOpened' },
  trackEvent: vi.fn(),
  configurationFromChannel: () => ({ includeDeletedPosts: false }),
}));
vi.mock('@tloncorp/shared/store', () => ({
  usePostWithThreadUnreads: ({ id }: { id: string }) => state.queries.get(id),
  useCanUpload: () => true,
  uploadAsset: vi.fn(),
  syncThreadPosts: state.sync,
  useChannelContext: () => ({
    channel: state.channel,
    group: null,
    negotiationStatus: { matchedOrPending: true },
    setEditingPost: vi.fn(),
  }),
  draftKeyFor: {
    thread: ({ parentPostId }: { parentPostId: string }) => parentPostId,
  },
  useShowDeleteMarkers: () => ({ data: false }),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  LoadingSpinner: 'LoadingSpinner',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({ View: 'View' }));
vi.mock('../../hooks/useChatSettingsNavigation', () => ({
  useChatSettingsNavigation: () => ({}),
}));
vi.mock('../../hooks/useGroupActions', () => ({
  useGroupActions: () => ({ performGroupAction: vi.fn() }),
}));
vi.mock('../../hooks/useChannelNavigation', () => ({
  useChannelNavigation: () => ({}),
}));
vi.mock('../../navigation/utils', () => ({
  useNavigation: () => ({ goBack: state.back }),
  useRootNavigation: () => ({
    navigateBackFromPost: state.back,
    resetToChannel: state.reset,
  }),
}));
vi.mock('../../ui', () => ({
  AttachmentProvider: 'AttachmentProvider',
  ChatOptionsProvider: 'ChatOptionsProvider',
  ScreenHeader: 'ScreenHeader',
  useCurrentUserId: () => '~zod',
  PostScreenView: ({ parentPost }: { parentPost: db.Post }) => {
    const [draft, setDraft] = React.useState('retained draft');
    React.useEffect(() => {
      state.viewMounts++;
      return () => {
        state.viewUnmounts++;
      };
    }, []);
    return (
      <input
        data-parent={parentPost.id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  },
}));

let root: ReactTestRenderer | undefined;
const navigation = { goBack: state.back, canGoBack: () => state.canGoBack };
const post = (id: string) =>
  ({ id, channelId: 'channel', authorId: '~ten' }) as db.Post;
function query(id: string, data: db.Post | null = null, isLoading = false) {
  const value = {
    data,
    isLoading,
    isFetched: !isLoading,
    refetch: vi.fn().mockResolvedValue({ data, isError: false }),
  };
  state.queries.set(id, value);
  return value;
}
function render(
  id = 'A',
  options: { channelId?: string; groupId?: string } = {}
) {
  const props = {
    navigation,
    route: {
      key: `route-${id}`,
      name: 'Post',
      params: {
        postId: id,
        channelId: options.channelId ?? 'channel',
        groupId: options.groupId,
        authorId: '~ten',
      },
    },
  } as unknown as React.ComponentProps<typeof PostScreen>;
  act(() => {
    if (root) root.update(<PostScreen {...props} />);
    else root = create(<PostScreen {...props} />);
  });
}
const all = (type: string) => root!.root.findAllByType(type as never);
const header = () => {
  const headers = all('ScreenHeader');
  expect(
    headers,
    'Missing-parent routes retain a real ScreenHeader'
  ).toHaveLength(1);
  return headers[0];
};
const text = () => JSON.stringify(root!.toJSON());
const settle = async (run: () => void) => {
  await act(async () => {
    run();
    await Promise.resolve();
  });
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  state.focused = true;
  state.canGoBack = true;
  state.channel = { id: 'channel', type: 'chat' } as db.Channel;
  state.queries.clear();
  state.sync.mockReset();
  state.back.mockReset();
  state.reset.mockReset();
  state.viewMounts = 0;
  state.viewUnmounts = 0;
  state.sync.mockReturnValue(new Promise<void>(() => {}));
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});

describe('PostScreen missing-parent recovery', () => {
  it('keeps a named navigable loading shell during the unresolved initial local query', () => {
    query('A', null, true);
    render();
    expect(header().props.title).toBe('Thread');
    expect(all('LoadingSpinner')).toHaveLength(1);
    expect(state.sync).not.toHaveBeenCalled();
    act(() => header().props.backAction());
    expect(state.back).toHaveBeenCalledOnce();
  });
  it('does not call stale absence unavailable while the explicit post-sync refetch is still pending', async () => {
    const sync = deferred<void>(),
      fresh = deferred<{ data: db.Post; isError: boolean }>();
    state.sync.mockReturnValue(sync.promise);
    const q = query('A');
    q.refetch.mockReturnValue(fresh.promise);
    render();
    await settle(() => sync.resolve());
    expect(q.refetch).toHaveBeenCalledWith({ throwOnError: true });
    expect(all('LoadingSpinner')).toHaveLength(1);
    expect(text()).not.toContain('not available');
    q.data = post('A');
    render();
    await settle(() => fresh.resolve({ data: post('A'), isError: false }));
    expect(all('input')[0].props['data-parent']).toBe('A');
    expect(all('LoadingSpinner')).toHaveLength(0);
    expect(state.back).not.toHaveBeenCalled();
  });
  it('catches a sync rejection and exposes Retry and Back without an automatic retry loop', async () => {
    const first = deferred<void>(),
      second = deferred<void>();
    state.sync
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    query('A');
    render();
    await settle(() => first.reject(Error('offline')));
    expect(text()).toContain('Could not load this thread.');
    expect(all('Button')[0].props.label).toBe('Try again');
    expect(state.sync).toHaveBeenCalledTimes(1);
    act(() => all('Button')[0].props.onPress());
    expect(state.sync).toHaveBeenCalledTimes(2);
    expect(all('LoadingSpinner')).toHaveLength(1);
    act(() => header().props.backAction());
    expect(state.back).toHaveBeenCalledOnce();
  });
  it('calls only an explicit settled fresh absence unavailable-yet, not deleted or not-found', async () => {
    state.sync.mockResolvedValue(undefined);
    query('A');
    render();
    await act(async () => {
      await Promise.resolve();
    });
    expect(text()).toContain('This thread is not available yet.');
    expect(text()).not.toContain('not found');
    expect(all('Button')[0].props.label).toBe('Try again');
    expect(state.sync).toHaveBeenCalledOnce();
    expect(state.back).not.toHaveBeenCalled();
  });
  it('catches a failed explicit fresh read without treating it as authoritative absence', async () => {
    state.sync.mockResolvedValue(undefined);
    query('A').refetch.mockRejectedValue(Error('local read failed'));
    render();
    await act(async () => {
      await Promise.resolve();
    });
    expect(text()).toContain('Could not load this thread.');
    expect(text()).not.toContain('not available yet');
    expect(all('Button')[0].props.label).toBe('Try again');
    expect(state.back).not.toHaveBeenCalled();
  });
  it('keeps the cached view and its draft through refetch loading and error flags', () => {
    const q = query('A', post('A'));
    render();
    act(() =>
      all('input')[0].props.onChange({ target: { value: 'draft survives' } })
    );
    q.isLoading = true;
    render();
    Object.assign(q, { isLoading: false, isError: true });
    render();
    expect(all('input')[0].props.value).toBe('draft survives');
    expect(state.viewMounts).toBe(1);
    expect(state.viewUnmounts).toBe(0);
    expect(all('LoadingSpinner')).toHaveLength(0);
    expect(state.sync).not.toHaveBeenCalled();
  });
  it('ignores a rejected old route after replacement without refetching or navigating the new route', async () => {
    const a = deferred<void>(),
      b = deferred<void>();
    state.sync.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const qa = query('A');
    query('B');
    render();
    render('B');
    await settle(() => a.reject(Error('old A failure')));
    expect(all('LoadingSpinner')).toHaveLength(1);
    expect(text()).not.toContain('Could not load');
    expect(qa.refetch).not.toHaveBeenCalled();
    expect(state.back).not.toHaveBeenCalled();
  });
  it('permanently retires old completion and Back across focus loss and return', async () => {
    const old = deferred<void>(),
      current = deferred<void>();
    state.sync
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const q = query('A');
    render();
    const oldBack = header().props.backAction;
    state.focused = false;
    render();
    state.focused = true;
    render();
    await settle(() => old.resolve());
    act(() => oldBack());
    expect(q.refetch).not.toHaveBeenCalled();
    expect(state.back).not.toHaveBeenCalled();
    expect(state.sync).toHaveBeenCalledTimes(2);
    expect(all('LoadingSpinner')).toHaveLength(1);
  });
  it('does not publish or refetch after unmount when an old successful sync finishes', async () => {
    const sync = deferred<void>();
    state.sync.mockReturnValue(sync.promise);
    const q = query('A');
    render();
    act(() => root!.unmount());
    root = undefined;
    await settle(() => sync.resolve());
    expect(q.refetch).not.toHaveBeenCalled();
    expect(state.back).not.toHaveBeenCalled();
  });
  it('keeps Back while a cached parent is waiting for its required channel context', () => {
    query('A', post('A'));
    state.channel = null;
    render();
    expect(all('LoadingSpinner')).toHaveLength(1);
    expect(header().props.title).toBe('Thread');
    act(() => header().props.backAction());
    expect(state.back).toHaveBeenCalledOnce();
    state.channel = { id: 'channel', type: 'chat' } as db.Channel;
    render();
    expect(all('input')[0].props['data-parent']).toBe('A');
    expect(state.sync).not.toHaveBeenCalled();
  });
});

it.each([true, false])(
  'recovers from missing-parent routes with live canGoBack=%s',
  (canGoBack) => {
    state.canGoBack = canGoBack;
    query('A', null, true);
    render('A', { groupId: '~zod/group' });
    act(() => header().props.backAction());
    if (canGoBack) {
      expect(state.back).toHaveBeenCalledOnce();
      expect(state.reset).not.toHaveBeenCalled();
    } else {
      expect(state.reset).toHaveBeenCalledOnce();
      expect(state.reset).toHaveBeenCalledWith('channel', {
        groupId: '~zod/group',
      });
      expect(state.back).not.toHaveBeenCalled();
    }
  }
);
it('consults navigation history at press time without requiring a query or rerender', () => {
  query('A', null, true);
  render();
  const back = header().props.backAction;
  state.canGoBack = false;
  act(() => back());
  expect(state.reset).toHaveBeenCalledOnce();
  expect(state.reset).toHaveBeenCalledWith('channel', { groupId: undefined });
  expect(state.back).not.toHaveBeenCalled();
});
it('cannot use an old loading callback to reset a replacement channel or a returned visit', () => {
  state.canGoBack = false;
  query('A', null, true);
  query('B', null, true);
  render('A', { channelId: 'channel-A', groupId: 'group-A' });
  const oldBack = header().props.backAction;
  render('B', { channelId: 'channel-B', groupId: 'group-B' });
  act(() => oldBack());
  expect(state.reset).not.toHaveBeenCalled();
  render('A', { channelId: 'channel-A', groupId: 'group-A' });
  act(() => oldBack());
  expect(state.reset).not.toHaveBeenCalled();
  act(() => header().props.backAction());
  expect(state.reset).toHaveBeenCalledOnce();
  expect(state.reset).toHaveBeenCalledWith('channel-A', { groupId: 'group-A' });
  expect(state.back).not.toHaveBeenCalled();
});

it.each(['reject', 'absent'] as const)(
  'keeps one current request through an undefined-data fresh read ending in %s',
  async (result) => {
    const sync = deferred<void>();
    const fresh = deferred<{ data: null; isError: false }>();
    state.sync.mockReturnValue(sync.promise);
    const q = query('A');
    Object.assign(q, { data: undefined, isError: true, isFetched: true });
    q.refetch.mockReturnValue(fresh.promise);
    render();
    await settle(() => sync.resolve());
    expect(q.refetch).toHaveBeenCalledOnce();
    // Installed QueryObserver: undefined data + refetch => pending/fetching;
    // isFetched stays true because the original error count is retained.
    Object.assign(q, { isLoading: true, isError: false });
    render();
    expect(all('LoadingSpinner')).toHaveLength(1);
    Object.assign(q, {
      isLoading: false,
      isError: result === 'reject',
      data: result === 'absent' ? null : undefined,
    });
    render();
    await settle(() =>
      result === 'reject'
        ? fresh.reject(Error('fresh read failed'))
        : fresh.resolve({ data: null, isError: false })
    );
    expect(state.sync).toHaveBeenCalledOnce();
    expect(all('LoadingSpinner')).toHaveLength(0);
    expect(text()).toContain(
      result === 'reject'
        ? 'Could not load this thread.'
        : 'This thread is not available yet.'
    );
    expect(all('Button')[0].props.label).toBe('Try again');
  }
);

it('grounds the acquisition gate in the installed QueryObserver error/refetch/absence/cached transitions', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const queryKey = ['post-loading-gate'];
  await expect(
    client.fetchQuery({
      queryKey,
      queryFn: async () => {
        throw Error('initial local read');
      },
    })
  ).rejects.toThrow('initial local read');
  let fetchResult = deferred<db.Post | null>();
  const observer = new QueryObserver<db.Post | null>(client, {
    queryKey,
    enabled: false,
    queryFn: () => fetchResult.promise,
  });
  const stop = observer.subscribe(() => {});
  try {
    expect(observer.getCurrentResult()).toMatchObject({
      data: undefined,
      isError: true,
      isLoading: false,
      isFetched: true,
    });
    let pending = observer.refetch({ throwOnError: true });
    expect(observer.getCurrentResult()).toMatchObject({
      data: undefined,
      isLoading: true,
      isFetched: true,
    });
    fetchResult.reject(Error('fresh local read'));
    await expect(pending).rejects.toThrow('fresh local read');
    expect(observer.getCurrentResult()).toMatchObject({
      data: undefined,
      isError: true,
      isLoading: false,
      isFetched: true,
    });
    fetchResult = deferred<db.Post | null>();
    pending = observer.refetch({ throwOnError: true });
    fetchResult.resolve(null);
    await pending;
    expect(observer.getCurrentResult()).toMatchObject({
      data: null,
      isLoading: false,
      isFetched: true,
      isError: false,
    });
    fetchResult = deferred<db.Post | null>();
    pending = observer.refetch({ throwOnError: true });
    expect(observer.getCurrentResult()).toMatchObject({
      data: null,
      isLoading: false,
      isFetched: true,
    });
    fetchResult.resolve(post('A'));
    await pending;
    fetchResult = deferred<db.Post | null>();
    pending = observer.refetch({ throwOnError: true });
    expect(observer.getCurrentResult()).toMatchObject({
      data: post('A'),
      isLoading: false,
      isFetched: true,
    });
    fetchResult.reject(Error('cached refetch'));
    await expect(pending).rejects.toThrow('cached refetch');
    expect(observer.getCurrentResult()).toMatchObject({
      data: post('A'),
      isLoading: false,
      isFetched: true,
      isError: true,
    });
  } finally {
    stop();
    observer.destroy();
    client.clear();
  }
});
