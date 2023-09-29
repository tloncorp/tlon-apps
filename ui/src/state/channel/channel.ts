import bigInt, { BigInteger } from 'big-integer';
import _ from 'lodash';
import { decToUd, udToDec, unixToDa } from '@urbit/api';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Poke } from '@urbit/http-api';
import create from 'zustand';
import { QueryKey, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Flag } from '@/types/hark';
import {
  Channels,
  PostAction,
  Channel,
  Perm,
  Memo,
  Reply,
  Action,
  DisplayMode,
  SortMode,
  Said,
  Create,
  Unreads,
  PostEssay,
  Story,
  Posts,
  ChannelsResponse,
  ChannelsAction,
  Post,
  Nest,
  PageMap,
  newPostMap,
  newReplyMap,
  PageTuple,
  UnreadUpdate,
  PagedPosts,
  PagedPostsMap,
  PostInCache,
  Pins,
  ChannelScan,
  ReferenceResponse,
  ReplyTuple,
  newChatMap,
} from '@/types/channel';
import {
  extendCurrentWindow,
  getWindow,
  Window,
  WindowSet,
} from '@/logic/windows';
import api from '@/api';
import { checkNest, log, nestToFlag, restoreMap } from '@/logic/utils';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import queryClient from '@/queryClient';
import { useChatStore } from '@/chat/useChatStore';

async function updatePostInCache(
  variables: { nest: Nest; postId: string },
  updater: (post: PostInCache | undefined) => PostInCache | undefined
) {
  const [han, flag] = nestToFlag(variables.nest);
  await queryClient.cancelQueries({
    queryKey: [han, 'posts', flag, variables.postId],
    exact: true,
  });

  queryClient.setQueryData([han, 'posts', flag, variables.postId], updater);
}

async function updatePostsInCache(
  variables: { nest: Nest },
  updater: (posts: Posts | undefined) => Posts | undefined
) {
  const [han, flag] = nestToFlag(variables.nest);
  await queryClient.cancelQueries([han, 'posts', flag]);

  queryClient.setQueryData([han, 'posts', flag], updater);
}

export function channelAction(
  nest: Nest,
  action: Action
): Poke<ChannelsAction> {
  checkNest(nest);
  return {
    app: 'channels',
    mark: 'channel-action',
    json: {
      channel: {
        nest,
        action,
      },
    },
  };
}

export function channelPostAction(nest: Nest, action: PostAction) {
  checkNest(nest);

  return channelAction(nest, {
    post: action,
  });
}

export interface PostWindows {
  [nest: string]: WindowSet;
}

export type PostStatus = 'pending' | 'sent' | 'delivered';

export interface TrackedPost {
  cacheId: CacheId;
  status: PostStatus;
}

export interface CacheId {
  author: string;
  sent: number;
}

export interface State {
  trackedPosts: TrackedPost[];
  postWindows: PostWindows;
  addTracked: (id: CacheId) => void;
  updateStatus: (id: CacheId, status: PostStatus) => void;
  getCurrentWindow: (nest: string, time?: string) => Window | undefined;
  extendCurrentWindow: (nest: Nest, newWindow: Window, time?: string) => void;
  [key: string]: unknown;
}

export const usePostsStore = create<State>((set, get) => ({
  trackedPosts: [],
  postWindows: {},
  addTracked: (id) => {
    set((state) => ({
      trackedPosts: [{ status: 'pending', cacheId: id }, ...state.trackedPosts],
    }));
  },
  updateStatus: (id, s) => {
    log('setting status', s);
    set((state) => ({
      trackedPosts: state.trackedPosts.map(({ cacheId, status }) => {
        if (_.isEqual(cacheId, id)) {
          return { status: s, cacheId };
        }

        return { status, cacheId };
      }),
    }));
  },
  getCurrentWindow: (nest, time) => {
    const currentSet = get().postWindows[nest];
    return getWindow(currentSet, time);
  },
  extendCurrentWindow: (nest, newWindow, time) => {
    set((state) => {
      const currentSet = state.postWindows[nest];

      return {
        postWindows: {
          ...state.postWindows,
          [nest]: extendCurrentWindow(newWindow, currentSet, time),
        },
      };
    });
  },
}));

export function useCurrentWindow(nest: Nest, time?: string) {
  const getCurrentWindow = useCallback(
    () => usePostsStore.getState().getCurrentWindow(nest, time),
    [time, nest]
  );

  return getCurrentWindow();
}

export function useTrackedPosts() {
  return usePostsStore((s) => s.trackedPosts);
}

export function useIsPostPending(cacheId: CacheId) {
  return usePostsStore((s) =>
    s.trackedPosts.some(
      ({ status: postStatus, cacheId: nId }) =>
        postStatus === 'pending' &&
        nId.author === cacheId.author &&
        nId.sent === cacheId.sent
    )
  );
}

export function useTrackedPostStatus(cacheId: CacheId) {
  return usePostsStore(
    (s) =>
      s.trackedPosts.find(
        ({ cacheId: nId }) =>
          nId.author === cacheId.author && nId.sent === cacheId.sent
      )?.status || 'delivered'
  );
}

export function usePosts(nest: Nest) {
  const [han, flag] = nestToFlag(nest);
  const { data, ...rest } = useReactQuerySubscription<Posts>({
    queryKey: [han, 'posts', flag],
    app: 'channels',
    path: `/${nest}/ui`,
    scry: `/${nest}/posts/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
  });

  if (data === undefined || Object.entries(data).length === 0) {
    return {
      posts: newPostMap(),
      ...rest,
    };
  }

  const diff: [BigInteger, Post][] = Object.entries(data).map(([k, v]) => [
    bigInt(udToDec(k)),
    v as Post,
  ]);

  const postsMap = newPostMap(diff);

  return {
    posts: postsMap as PageMap,
    ...rest,
  };
}

export function usePostsOnHost(
  nest: Nest,
  enabled: boolean
): Posts | undefined {
  const [han, flag] = nestToFlag(nest);
  const { data } = useReactQueryScry({
    queryKey: [han, 'posts', 'live', flag],
    app: 'channels',
    path: `/${nest}/posts/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
    options: {
      cacheTime: 0,
      enabled,
      refetchInterval: 1000,
    },
  });

  if (
    data === undefined ||
    data === null ||
    Object.entries(data as object).length === 0
  ) {
    return undefined;
  }

  return data as Posts;
}

export function useOlderPosts(nest: Nest, count: number, enabled = false) {
  checkNest(nest);
  const { posts } = usePosts(nest);

  let postMap = restoreMap<Post>(posts);

  const index = postMap.peekSmallest()?.[0];
  const oldPostsSize = postMap.size ?? 0;

  const fetchStart = index ? decToUd(index.toString()) : decToUd('0');

  const [han, flag] = nestToFlag(nest);

  const { data, ...rest } = useReactQueryScry({
    queryKey: [han, 'posts', flag, 'older', fetchStart],
    app: 'channels',
    path: `/${nest}/posts/older/${fetchStart}/${count}/outline`,
    priority: 2,
    options: {
      enabled:
        enabled &&
        index !== undefined &&
        oldPostsSize !== 0 &&
        !!fetchStart &&
        fetchStart !== decToUd('0'),
    },
  });

  if (
    rest.isError ||
    data === undefined ||
    Object.entries(data as object).length === 0 ||
    !enabled
  ) {
    return false;
  }

  const diff = Object.entries(data as object).map(([k, v]) => ({
    tim: bigInt(udToDec(k)),
    post: v as Post,
  }));

  diff.forEach(({ tim, post }) => {
    postMap = postMap.set(tim, post);
  });

  queryClient.setQueryData([han, 'posts', flag], postMap.root);

  return rest.isLoading;
}

const infinitePostUpdater = (
  queryKey: QueryKey,
  data: ChannelsResponse,
  initialTime?: string
) => {
  const { nest, response } = data;

  if (!('post' in response)) {
    return;
  }

  const postResponse = response.post['r-post'];
  const { id } = response.post;
  const time = bigInt(udToDec(id));

  if ('set' in postResponse) {
    const post = postResponse.set;

    if (post === null) {
      queryClient.setQueryData(
        queryKey,
        (
          d: { pages: PagedPostsMap[]; pageParams: PageParam[] } | undefined
        ) => {
          if (d === undefined) {
            return undefined;
          }

          const newPages = d.pages.map((page) => {
            const inPage = page.posts.has(time);

            if (inPage) {
              page.posts.set(bigInt(id), null);
            }

            return page;
          });

          return {
            pages: newPages,
            pageParams: d.pageParams,
          };
        }
      );
    } else {
      queryClient.setQueryData(
        queryKey,
        (
          d: { pages: PagedPostsMap[]; pageParams: PageParam[] } | undefined
        ) => {
          if (d === undefined) {
            return {
              pages: [
                {
                  posts: newPostMap([[time, post]]),
                  newer: null,
                  older: null,
                  total: 1,
                },
              ],
              pageParams: [],
            };
          }

          const lastPage = _.last(d.pages);

          if (lastPage === undefined) {
            return undefined;
          }

          const newLastPage = {
            ...lastPage,
            posts: lastPage.posts.with(time, post),
          };

          const cachedPost = lastPage.posts.get(unixToDa(post.essay.sent));

          if (cachedPost && id !== unixToDa(post.essay.sent).toString()) {
            // remove cached post if it exists
            newLastPage.posts.delete(unixToDa(post.essay.sent));

            // set delivered now that we have the real post
            usePostsStore
              .getState()
              .updateStatus(
                { author: post.essay.author, sent: post.essay.sent },
                'delivered'
              );
          }

          return {
            pages: [...d.pages.slice(0, -1), newLastPage],
            pageParams: d.pageParams,
          };
        }
      );
    }
  } else if ('reacts' in postResponse) {
    queryClient.setQueryData(
      queryKey,
      (d: { pages: PagedPostsMap[]; pageParams: PageParam[] } | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const { reacts } = postResponse;

        const newPages = d.pages.map((page) => {
          const inPage = page.posts.has(time);

          if (inPage) {
            const post = page.posts.get(time);
            if (!post) {
              return page;
            }
            page.posts.set(time, {
              ...post,
              seal: {
                ...post.seal,
                reacts,
              },
            });

            return page;
          }

          return page;
        });

        return {
          pages: newPages,
          pageParams: d.pageParams,
        };
      }
    );
  } else if ('essay' in postResponse) {
    queryClient.setQueryData(
      queryKey,
      (d: { pages: PagedPostsMap[]; pageParams: PageParam[] } | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const { essay } = postResponse;

        const newPages = d.pages.map((page) => {
          const inPage = page.posts.has(time);

          if (inPage) {
            const post = page.posts.get(time);
            if (!post) {
              return page;
            }
            page.posts.set(time, {
              ...post,
              essay,
            });

            return page;
          }

          return page;
        });

        return {
          pages: newPages,
          pageParams: d.pageParams,
        };
      }
    );
  } else if ('reply' in postResponse) {
    queryClient.setQueryData(
      queryKey,
      (d: { pages: PagedPostsMap[]; pageParams: PageParam[] } | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const {
          reply: {
            meta: { replyCount, lastReply, lastRepliers },
          },
        } = postResponse;

        const newPages = d.pages.map((page) => {
          const inPage = page.posts.has(time);

          if (inPage) {
            const post = page.posts.get(time);
            if (!post) {
              return page;
            }
            page.posts.set(time, {
              ...post,
              seal: {
                ...post.seal,
                meta: {
                  replyCount,
                  lastReply,
                  lastRepliers,
                },
              },
            });

            return page;
          }

          return page;
        });

        return {
          pages: newPages,
          pageParams: d.pageParams,
        };
      }
    );
  }
};

interface PageParam {
  time: BigInteger;
  direction: string;
}

export function useInfinitePosts(nest: Nest, initialTime?: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = useMemo(() => [han, 'posts', flag, 'infinite'], [han, flag]);

  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      },
      300,
      {
        leading: true,
        trailing: true,
      }
    )
  );

  useEffect(() => {
    api.subscribe({
      app: 'channels',
      path: `/${nest}/ui`,
      event: (data: ChannelsResponse) => {
        infinitePostUpdater(queryKey, data, initialTime);
        invalidate.current();
      },
    });
  }, [nest, invalidate, queryKey, initialTime]);

  const { data, ...rest } = useInfiniteQuery<PagedPostsMap>({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam?: PageParam }) => {
      let path = '';

      if (pageParam) {
        const { time, direction } = pageParam;
        const ud = decToUd(time.toString());
        path = `/${nest}/posts/${direction}/${ud}/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`;
      } else if (initialTime) {
        path = `/${nest}/posts/around/${decToUd(initialTime)}/${
          INITIAL_MESSAGE_FETCH_PAGE_SIZE / 2
        }/outline`;
      } else {
        path = `/${nest}/posts/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`;
      }

      const response = await api.scry<PagedPosts>({
        app: 'channels',
        path,
      });

      const posts = newPostMap(
        Object.entries(response.posts).map(([k, v]) => [bigInt(udToDec(k)), v])
      );

      return {
        ...response,
        posts,
      };
    },
    getNextPageParam: (lastPage): PageParam | undefined => {
      const { newer } = lastPage;

      if (!newer) {
        return undefined;
      }

      return {
        time: bigInt(newer),
        direction: 'newer',
      };
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      const { older } = firstPage;

      if (!older) {
        return undefined;
      }

      return {
        time: bigInt(older),
        direction: 'older',
      };
    },
    refetchOnMount: true,
    retryOnMount: true,
    retry: false,
  });

  if (data === undefined || data.pages.length === 0) {
    return {
      posts: [] as PageTuple[],
      data,
      ...rest,
    };
  }

  const posts: PageTuple[] = data.pages
    .map((page) => page.posts.toArray())
    .flat();

  return {
    posts,
    data,
    ...rest,
  };
}

function removePostFromInfiniteQuery(nest: string, time: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = [han, 'posts', flag, 'infinite'];
  const deletedId = decToUd(time);
  const currentData = queryClient.getQueryData(queryKey) as any;
  const newPages =
    currentData?.pages.map((page: any) =>
      page.filter(([id]: any) => id !== deletedId)
    ) ?? [];
  queryClient.setQueryData(queryKey, (data: any) => ({
    pages: newPages,
    pageParams: data.pageParams,
  }));
}

export async function prefetchPostWithComments({
  nest,
  time,
}: {
  nest: Nest;
  time: string;
}) {
  const ud = decToUd(time);
  const [han] = nestToFlag(nest);
  const data = (await api.scry({
    app: 'channels',
    path: `/${nest}/posts/post/${ud}`,
  })) as Post;
  if (data) {
    queryClient.setQueryData([han, nest, 'posts', time, 'withComments'], data);
  }
}

export function useReplyPost(nest: Nest, id: string | null) {
  const { posts } = useInfinitePosts(nest);

  return id && posts.find(([k, v]) => k.eq(bigInt(id)));
}

export function useOrderedPosts(
  nest: Nest,
  currentId: bigInt.BigInteger | string
) {
  checkNest(nest);
  const { posts } = useInfinitePosts(nest);

  if (posts.length === 0) {
    return {
      hasNext: false,
      hasPrev: false,
      nextPost: null,
      prevPost: null,
      sortedOutlines: [],
    };
  }

  const sortedOutlines = posts;

  sortedOutlines.sort(([a], [b]) => b.compare(a));

  const postId = typeof currentId === 'string' ? bigInt(currentId) : currentId;
  const newest = posts[posts.length - 1]?.[0];
  const oldest = posts[0]?.[0];
  const hasNext = posts.length > 0 && newest && postId.gt(newest);
  const hasPrev = posts.length > 0 && oldest && postId.lt(oldest);
  const currentIdx = sortedOutlines.findIndex(([i, _c]) => i.eq(postId));

  const nextPost = hasNext ? sortedOutlines[currentIdx - 1] : null;
  if (nextPost) {
    prefetchPostWithComments({
      nest,
      time: udToDec(nextPost[0].toString()),
    });
  }
  const prevPost = hasPrev ? sortedOutlines[currentIdx + 1] : null;
  if (prevPost) {
    prefetchPostWithComments({
      nest,
      time: udToDec(prevPost[0].toString()),
    });
  }

  return {
    hasNext,
    hasPrev,
    nextPost,
    prevPost,
    sortedOutlines,
  };
}

const emptyChannels: Channels = {};
export function useChannels(): Channels {
  const { data, ...rest } = useReactQuerySubscription<Channels>({
    queryKey: ['channels'],
    app: 'channels',
    path: '/ui',
    scry: '/channels',
    options: {
      refetchOnMount: false,
    },
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyChannels;
  }

  return data;
}

export function useChannel(nest: Nest): Channel | undefined {
  checkNest(nest);
  const channels = useChannels();

  return channels[nest];
}

const defaultPerms = {
  writers: [],
};

export function useArrangedPosts(nest: Nest): string[] {
  checkNest(nest);
  const channel = useChannel(nest);

  if (channel === undefined || channel.order === undefined) {
    return [];
  }

  return channel.order;
}

export function usePerms(nest: Nest): Perm {
  const channel = useChannel(nest);

  const [_han, flag] = nestToFlag(nest);

  if (channel === undefined) {
    return {
      group: flag,
      ...defaultPerms,
    };
  }

  return channel.perms as Perm;
}

export function usePost(nest: Nest, postId: string, disabled = false) {
  const [han, flag] = nestToFlag(nest);

  const queryKey = useMemo(
    () => [han, 'posts', flag, postId],
    [han, flag, postId]
  );

  const path = useMemo(
    () => `/${nest}/posts/post/${decToUd(postId)}`,
    [nest, postId]
  );

  const enabled = useMemo(
    () => postId !== '0' && nest !== '' && !disabled,
    [postId, nest, disabled]
  );
  const { data, ...rest } = useReactQueryScry({
    queryKey,
    app: 'channels',
    path,
    options: {
      enabled,
    },
  });

  const post = data as PostInCache;

  const replies = post?.seal?.replies;

  if (replies === undefined || Object.entries(replies).length === 0) {
    return {
      post: {
        ...post,
        seal: {
          ...post?.seal,
          replies: newReplyMap(),
          lastReply: null,
        },
      },
      ...rest,
    };
  }

  const diff: [BigInteger, Reply][] = Object.entries(replies).map(([k, v]) => [
    bigInt(udToDec(k)),
    v as Reply,
  ]);

  const replyMap = newReplyMap(diff);

  const postWithReplies: Post = {
    ...post,
    seal: {
      ...post?.seal,
      replies: replyMap,
    },
  };

  return {
    post: postWithReplies,
    ...rest,
  };
}

export function useReply(
  nest: Nest,
  postId: string,
  replyId: string,
  isScrolling = false
) {
  checkNest(nest);

  const { post } = usePost(nest, postId, isScrolling);
  return useMemo(() => {
    if (post === undefined) {
      return undefined;
    }
    if (post.seal.replies === null || post.seal.replies.size === undefined) {
      return undefined;
    }
    const reply = post.seal.replies.get(bigInt(replyId));
    return reply;
  }, [post, replyId]);
}

const emptyUnreads: Unreads = {};
export function useUnreads(): Unreads {
  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({
          queryKey: ['unreads'],
          refetchType: 'none',
        });
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const eventHandler = (event: UnreadUpdate) => {
    invalidate.current();
    const { unread } = event;

    if (unread !== null) {
      queryClient.setQueryData(['unreads'], (d: Unreads | undefined) => {
        if (d === undefined) {
          return undefined;
        }
        const newUnreads = { ...d };
        newUnreads[event.nest] = unread;

        useChatStore.getState().update(newUnreads);
        return newUnreads;
      });
    }
  };

  const { data, ...rest } = useReactQuerySubscription<Unreads, UnreadUpdate>({
    queryKey: ['unreads'],
    app: 'channels',
    path: '/unreads',
    scry: '/unreads',
    onEvent: eventHandler,
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyUnreads;
  }

  return data as Unreads;
}

export function useIsJoined(nest: Nest) {
  checkNest(nest);
  const unreads = useUnreads();

  return Object.keys(unreads).includes(nest);
}

export function useUnread(nest: Nest) {
  checkNest(nest);

  const unreads = useUnreads();

  return unreads[nest];
}

export function useChats(): Channels {
  const channels = useChannels();

  const chatKeys = Object.keys(channels).filter((k) => k.startsWith('chat/'));

  const chats: Channels = {};

  chatKeys.forEach((k) => {
    chats[k] = channels[k];
  });

  return chats;
}

export function usePins(): Pins {
  const { data, ...rest } = useReactQueryScry<{ pins: Pins }>({
    queryKey: ['pins'],
    app: 'channels',
    path: '/pins',
  });

  if (rest.isLoading || rest.isError || data === undefined || !data.pins) {
    return [];
  }

  const { pins } = data;

  return pins;
}

export function useAddPinMutation() {
  const pins = usePins();
  const mutationFn = async (variables: { nest: Nest }) => {
    const newPins = pins.concat(variables.nest);

    await api.poke({
      app: 'channels',
      mark: 'channel-action',
      json: {
        pin: newPins,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['pins']);
      const prev = queryClient.getQueryData<{ pins: Pins }>(['pins']);

      if (prev !== undefined) {
        queryClient.setQueryData(['pins'], prev.pins.concat(variables.nest));
      }
    },
  });
}

export function useDeletePinMutation() {
  const pins = usePins();
  const mutationFn = async (variables: { nest: Nest }) => {
    const newPins = pins.filter((p) => p !== variables.nest);

    await api.poke({
      app: 'channels',
      mark: 'channel-action',
      json: {
        pin: newPins,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['pins']);
      const prev = queryClient.getQueryData<{ pins: Pins }>(['pins']);

      if (prev !== undefined) {
        queryClient.setQueryData(
          ['pins'],
          prev.pins.filter((p) => p !== variables.nest)
        );
      }
    },
  });
}

export function useDisplayMode(nest: string): DisplayMode {
  checkNest(nest);
  const channel = useChannel(nest);
  return channel?.view ?? 'list';
}

export function useSortMode(nest: string): SortMode {
  checkNest(nest);
  const channel = useChannel(nest);
  return channel?.sort ?? 'time';
}

export function useRemotePost(
  nest: Nest,
  id: string,
  blockLoad: boolean,
  replyId?: string
) {
  checkNest(nest);
  const [han, flag] = nestToFlag(nest);
  const path = `/said/${nest}/post/${decToUd(id)}${
    replyId ? `/${decToUd(replyId)}` : ''
  }`;

  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: [han, 'said', nest, id, replyId],
    app: 'channels',
    path,
    options: {
      enabled: !blockLoad,
    },
  });

  if (rest.isLoading || rest.isError || !data) {
    return {} as ReferenceResponse;
  }

  const { reference } = data as Said;

  return reference as ReferenceResponse;
}

export function usePostKeys(nest: Nest) {
  const { posts } = useInfinitePosts(nest);

  return useMemo(() => posts.map(([k]) => k), [posts]);
}

export function useGetFirstUnreadID(nest: Nest) {
  const keys = usePostKeys(nest);
  const unread = useUnread(nest);

  const { 'read-id': lastRead } = unread;

  if (!lastRead) {
    return null;
  }

  const lastReadBN = bigInt(lastRead);
  const firstUnread = keys.find((key) => key.gt(lastReadBN));
  return firstUnread ?? null;
}

export function useMarkReadMutation() {
  const mutationFn = async (variables: { nest: Nest }) => {
    checkNest(variables.nest);

    await api.poke(channelAction(variables.nest, { read: null }));
  };

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries(['unreads']);
    },
  });
}

export function useJoinMutation() {
  const mutationFn = async ({ group, chan }: { group: Flag; chan: Nest }) => {
    if (chan.split('/').length !== 3) {
      throw new Error('Invalid nest');
    }

    await api.trackedPoke<ChannelsAction, ChannelsResponse>(
      channelAction(chan, {
        join: group,
      }),
      { app: 'channels', path: '/ui' },
      (event) => event.nest === chan && 'create' in event.response
    );
  };

  return useMutation(mutationFn);
}

export function useLeaveMutation() {
  const mutationFn = async (variables: { nest: Nest }) => {
    checkNest(variables.nest);
    await api.poke(channelAction(variables.nest, { leave: null }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.cancelQueries(['channels']);
      await queryClient.cancelQueries(['unreads']);
      await queryClient.cancelQueries([han, 'perms', flag]);
      await queryClient.cancelQueries([han, 'posts', flag]);
      queryClient.removeQueries([han, 'perms', flag]);
      queryClient.removeQueries([han, 'posts', flag]);
    },
    onSettled: async (_data, _error) => {
      await queryClient.invalidateQueries(['channels']);
      await queryClient.invalidateQueries(['unreads']);
    },
  });
}

export function useViewMutation() {
  const mutationFn = async (variables: { nest: Nest; view: DisplayMode }) => {
    checkNest(variables.nest);
    await api.poke(channelAction(variables.nest, { view: variables.view }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['channels']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(['channels'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            view: variables.view,
          },
        });
      }
    },
  });
}

export function useSortMutation() {
  const mutationFn = async (variables: { nest: Nest; sort: SortMode }) => {
    await api.poke(channelAction(variables.nest, { sort: variables.sort }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      checkNest(variables.nest);

      await queryClient.cancelQueries(['channels']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(['channels'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            sort: variables.sort,
          },
        });
      }
    },
  });
}

export function useArrangedPostsMutation() {
  const { mutate: changeSortMutation } = useSortMutation();

  const mutationFn = async (variables: {
    nest: Nest;
    arrangedPosts: string[];
  }) => {
    checkNest(variables.nest);

    // change sort mode automatically if arrangedPosts is empty/not-empty
    if (variables.arrangedPosts.length === 0) {
      changeSortMutation({ nest: variables.nest, sort: 'time' });
    } else {
      changeSortMutation({ nest: variables.nest, sort: 'arranged' });
    }

    await api.poke(
      channelAction(variables.nest, {
        order: variables.arrangedPosts.map((t) => decToUd(t)),
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['channels']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(['channels'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            order: variables.arrangedPosts.map((t) => decToUd(t)),
          },
        });
      }
    },
  });
}

export function useAddPostMutation(nest: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = useCallback(
    (...args: any[]) => [han, 'posts', flag, ...args],
    [han, flag]
  );

  let timePosted: string;
  const mutationFn = async (variables: {
    cacheId: CacheId;
    essay: PostEssay;
  }) =>
    new Promise<string>((resolve) => {
      try {
        api
          .trackedPoke<ChannelsAction, ChannelsResponse>(
            channelPostAction(nest, {
              add: variables.essay,
            }),
            { app: 'channels', path: `/${nest}/ui` },
            ({ response }) => {
              if ('post' in response) {
                const { id, 'r-post': postResponse } = response.post;
                if (
                  'set' in postResponse &&
                  postResponse.set !== null &&
                  postResponse.set.essay.author === variables.essay.author &&
                  postResponse.set.essay.sent === variables.essay.sent
                ) {
                  timePosted = id;
                  return true;
                }
                return true;
              }

              return false;
            }
          )
          .then(() => {
            resolve(timePosted);
          });
      } catch (e) {
        console.error(e);
      }
    });

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(queryKey());

      usePostsStore.getState().addTracked(variables.cacheId);

      const sent = unixToDa(variables.essay.sent).toString();
      const post = {
        seal: {
          id: sent,
          replies: newReplyMap(),
          reacts: {},
          meta: {
            replyCount: 0,
            lastRepliers: [],
            lastReply: null,
          },
        },
        essay: variables.essay,
      };

      queryClient.setQueryData<Post>(queryKey(variables.cacheId), post);

      infinitePostUpdater(queryKey('infinite'), {
        nest,
        response: {
          post: {
            id: sent,
            'r-post': {
              set: post,
            },
          },
        },
      });
    },
    onSuccess: async (_data, variables) => {
      usePostsStore.getState().updateStatus(variables.cacheId, 'sent');
      queryClient.removeQueries(queryKey(variables.cacheId));
    },
    onSettled: async (_data, _error) => {
      await queryClient.invalidateQueries({
        queryKey: queryKey('infinite'),
        refetchType: 'none',
      });
    },
  });
}

export function useEditPostMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    time: string;
    essay: PostEssay;
  }) => {
    checkNest(variables.nest);

    await api.poke(
      channelPostAction(variables.nest, {
        edit: {
          id: decToUd(variables.time),
          essay: variables.essay,
        },
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: PostInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        return {
          ...prev,
          essay: variables.essay,
        };
      };

      const postsUpdater = (prev: Posts | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const prevPost = prev[decToUd(variables.time)];

        if (prevPost === null) {
          return prev;
        }

        return {
          ...prev,
          [variables.time]: {
            seal: prevPost.seal,
            essay: variables.essay,
          },
        };
      };

      await updatePostInCache(
        {
          nest: variables.nest,
          postId: variables.time,
        },
        updater
      );

      await updatePostsInCache(variables, postsUpdater);
    },
  });
}

export function useDeletePostMutation() {
  const mutationFn = async (variables: { nest: Nest; time: string }) => {
    checkNest(variables.nest);

    await api.trackedPoke<ChannelsAction, ChannelsResponse>(
      channelPostAction(variables.nest, { del: variables.time }),
      {
        app: 'channels',
        path: `/${variables.nest}/ui`,
      },
      (event) => {
        if ('post' in event.response) {
          const { id, 'r-post': postResponse } = event.response.post;
          return (
            id === variables.time &&
            'set' in postResponse &&
            postResponse.set === null
          );
        }
        return false;
      }
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const [han, flag] = nestToFlag(variables.nest);

      const updater = (prev: Posts | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const { [decToUd(variables.time)]: _n, ...rest } = prev;

        return rest;
      };

      await updatePostsInCache(variables, updater);

      await queryClient.cancelQueries([han, 'posts', flag, variables.time]);
    },
    onSuccess: async (_data, variables) => {
      removePostFromInfiniteQuery(variables.nest, variables.time);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'posts', flag]);
      await queryClient.invalidateQueries([han, 'posts', flag, 'infinite']);
    },
  });
}

export function useCreateMutation() {
  const mutationFn = async (variables: Create) => {
    await api.trackedPoke<ChannelsAction, ChannelsResponse>(
      {
        app: 'channels',
        mark: 'channel-action',
        json: {
          create: variables,
        },
      },
      { app: 'channels', path: '/ui' },
      (event) => {
        const { response, nest } = event;
        return (
          'create' in response &&
          nest === `${variables.kind}/${window.our}/${variables.name}`
        );
      }
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['channels']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(['channels'], {
          ...prev,
          [`${variables.kind}/${window.our}/${variables.name}`]: {
            perms: { writers: [], group: variables.group },
            view: 'list',
            order: [],
            sort: 'time',
            saga: { synced: null },
          },
        });
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries(['channels']);
      await queryClient.invalidateQueries([
        variables.kind,
        'posts',
        `${window.our}/${variables.name}`,
        { exact: true },
      ]);
    },
  });
}

export function useAddSectsMutation() {
  const mutationFn = async (variables: { nest: Nest; writers: string[] }) => {
    await api.poke(
      channelAction(variables.nest, { 'add-writers': variables.writers })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      checkNest(variables.nest);

      await queryClient.cancelQueries(['channels']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(['channels'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            perms: {
              ...prev[variables.nest].perms,
              writers: [
                ...prev[variables.nest].perms.writers,
                ...variables.writers,
              ],
            },
          },
        });
      }
    },
  });
}

export function useDeleteSectsMutation() {
  const mutationFn = async (variables: { nest: Nest; writers: string[] }) => {
    checkNest(variables.nest);

    await api.poke(
      channelAction(variables.nest, { 'del-writers': variables.writers })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['channels']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(['channels'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            perms: {
              ...prev[variables.nest].perms,
              writers: prev[variables.nest].perms.writers.filter(
                (writer) => !variables.writers.includes(writer)
              ),
            },
          },
        });
      }
    },
  });
}

export function useAddReplyMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    postId: string;
    content: Story;
  }) => {
    checkNest(variables.nest);

    const replying = decToUd(variables.postId);
    const memo: Memo = {
      content: variables.content,
      author: window.our,
      sent: Date.now(),
    };
    const action: Action = {
      post: {
        reply: {
          id: replying,
          action: {
            add: memo,
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const postsUpdater = (prev: Record<string, Post | null> | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const replying = decToUd(variables.postId);
        if (replying in prev) {
          const replyingPost = prev[replying] as Post;
          if (replyingPost === null) {
            return prev;
          }

          const updatedPost = {
            ...replyingPost,
            seal: {
              ...replyingPost.seal,
              replyCount: replyingPost.seal.meta.replyCount + 1,
              repliers: [...replyingPost.seal.meta.lastRepliers, window.our],
            },
          };

          return {
            ...prev,
            [replying]: updatedPost,
          };
        }
        return prev;
      };

      const updater = (prevPost: PostInCache | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }
        const prevReplies = prevPost.seal.replies;
        const dateTime = Date.now();
        const newReplies: Record<string, Reply> = {
          ...prevReplies,
          [decToUd(unixToDa(dateTime).toString())]: {
            seal: {
              id: unixToDa(dateTime).toString(),
              'parent-id': decToUd(variables.postId),
              reacts: {},
            },
            memo: {
              content: variables.content,
              author: window.our,
              sent: dateTime,
            },
          },
        };

        const updatedPost: PostInCache = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            replies: newReplies,
          },
        };

        return updatedPost;
      };

      await updatePostsInCache(variables, postsUpdater);
      await updatePostInCache(variables, updater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'posts', flag]);
      await queryClient.refetchQueries([han, 'posts', flag, variables.postId]);
    },
  });
}

export function useDeleteReplyMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    postId: string;
    replyId: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      post: {
        reply: {
          id: decToUd(variables.postId),
          action: {
            del: decToUd(variables.replyId),
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const postsUpdater = (prev: Record<string, Post | null> | undefined) => {
        if (prev === undefined) {
          return prev;
        }
        const replying = decToUd(variables.postId);
        if (replying in prev) {
          const replyingPost = prev[replying] as Post;

          if (replyingPost === null) {
            return prev;
          }

          const updatedPost = {
            ...replyingPost,
            seal: {
              ...replyingPost.seal,
              replyCount: replyingPost.seal.meta.replyCount - 1,
              repliers: replyingPost.seal.meta.lastRepliers.filter(
                (replier) => replier !== window.our
              ),
            },
          };

          return {
            ...prev,
            [replying]: updatedPost,
          };
        }
        return prev;
      };

      const updater = (prevPost: PostInCache | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }

        const prevReplies = prevPost.seal.replies;
        const newReplies = { ...prevReplies };
        delete newReplies[variables.replyId];

        const updatedPost: PostInCache = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            replies: newReplies,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, updater);
      await updatePostsInCache(variables, postsUpdater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'posts', flag]);
      await queryClient.refetchQueries([han, 'posts', flag, variables.postId]);
    },
  });
}

export function useAddPostReactMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    postId: string;
    react: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      post: {
        'add-react': {
          id: decToUd(variables.postId),
          react: variables.react,
          ship: window.our,
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prevPost: PostInCache | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }
        const prevReacts = prevPost.seal.reacts;
        const newReacts = {
          ...prevReacts,
          [unixToDa(Date.now()).toString()]: variables.react,
        };

        const updatedPost: PostInCache = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            reacts: newReacts,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, updater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'posts', flag]);
      await queryClient.invalidateQueries([
        han,
        'posts',
        flag,
        variables.postId,
      ]);
    },
  });
}

export function useDeletePostReactMutation() {
  const mutationFn = async (variables: { nest: Nest; postId: string }) => {
    checkNest(variables.nest);

    const action: Action = {
      post: {
        'del-react': {
          id: decToUd(variables.postId),
          ship: window.our,
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: PostInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const prevReacts = prev.seal.reacts;
        const newReacts = {
          ...prevReacts,
        };
        delete newReacts[window.our];

        const updatedPost = {
          ...prev,
          seal: {
            ...prev.seal,
            reacts: newReacts,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, updater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'posts', flag]);
      await queryClient.invalidateQueries([
        han,
        'posts',
        flag,
        variables.postId,
      ]);
    },
  });
}

export function useAddReplyReactMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    postId: string;
    replyId: string;
    react: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      post: {
        reply: {
          id: decToUd(variables.postId),
          action: {
            'add-react': {
              id: decToUd(variables.replyId),
              react: variables.react,
              ship: window.our,
            },
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: PostInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const { replies } = prev.seal;
        Object.entries(replies).forEach(([time, reply]) => {
          if (time === decToUd(variables.replyId)) {
            replies[decToUd(variables.replyId)] = {
              ...reply,
              seal: {
                ...reply.seal,
                reacts: {
                  ...reply.seal.reacts,
                  [window.our]: variables.react,
                },
              },
            };
          }
        });

        const updatedPost = {
          ...prev,
          seal: {
            ...prev.seal,
            replies,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, updater);
    },
  });
}

export function useDeleteReplyReactMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    postId: string;
    replyId: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      post: {
        reply: {
          id: decToUd(variables.postId),
          action: {
            'del-react': {
              id: decToUd(variables.replyId),
              ship: window.our,
            },
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: PostInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }
        const { replies } = prev.seal;
        Object.entries(replies).forEach(([time, reply]) => {
          if (time === decToUd(variables.replyId)) {
            const newReacts = {
              ...reply.seal.reacts,
            };
            delete newReacts[window.our];

            replies[decToUd(variables.replyId)] = {
              ...reply,
              seal: {
                ...reply.seal,
                reacts: newReacts,
              },
            };
          }
        });

        const updatedPost = {
          ...prev,
          seal: {
            ...prev.seal,
            replies,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, updater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([
        han,
        'posts',
        flag,
        variables.postId,
      ]);
    },
  });
}

export function useChannelSearch(nest: string, query: string) {
  const { data, ...rest } = useReactQueryScry<ChannelScan>({
    queryKey: ['channel', 'search', nest, query],
    app: 'channels',
    path: `/${nest}/search/text/0/1.000/${query}`,
    options: {
      enabled: query !== '',
    },
  });

  const scan = useMemo(
    () =>
      newChatMap(
        (data || []).map((scItem) =>
          scItem && 'post' in scItem
            ? ([bigInt(scItem.post.seal.id), scItem.post] as PageTuple)
            : ([
                bigInt(scItem.reply.reply.seal.id),
                scItem.reply.reply,
              ] as ReplyTuple)
        ),
        true
      ),
    [data]
  );

  return {
    scan,
    ...rest,
  };
}
