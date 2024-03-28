import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import {
  Action,
  CacheId,
  Channel,
  ChannelScam,
  ChannelScan,
  ChannelScanItem,
  Channels,
  ChannelsAction,
  ChannelsResponse,
  ChannelsSubscribeResponse,
  Create,
  DisplayMode,
  HiddenPosts,
  Memo,
  Nest,
  PagedPosts,
  PendingMessages,
  Perm,
  Post,
  PostAction,
  PostDataResponse,
  PostEssay,
  PostTuple,
  Posts,
  Replies,
  Reply,
  ReplyMeta,
  ReplyTuple,
  Said,
  SortMode,
  TogglePost,
  UnreadUpdate,
  Unreads,
  newChatMap,
  newPostTupleArray,
} from '@tloncorp/shared/dist/urbit/channel';
import {
  PagedWrits,
  Writ,
  newWritTupleArray,
} from '@tloncorp/shared/dist/urbit/dms';
import { Flag } from '@tloncorp/shared/dist/urbit/hark';
import { daToUnix, decToUd, udToDec, unixToDa } from '@urbit/api';
import { Poke } from '@urbit/http-api';
import bigInt from 'big-integer';
import _, { last } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import create from 'zustand';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import {
  LARGE_MESSAGE_FETCH_PAGE_SIZE,
  STANDARD_MESSAGE_FETCH_PAGE_SIZE,
} from '@/constants';
import asyncCallWithTimeout from '@/logic/asyncWithTimeout';
import { isNativeApp } from '@/logic/native';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import {
  cacheIdFromString,
  cacheIdToString,
  checkNest,
  log,
  nestToFlag,
  stringToTa,
  useIsDmOrMultiDm,
  whomIsFlag,
} from '@/logic/utils';
import queryClient from '@/queryClient';

// eslint-disable-next-line import/no-cycle
import ChatQueryKeys from '../chat/keys';
import { channelKey, infinitePostsKey, postKey } from './keys';
import shouldAddPostToCache from './util';

const POST_PAGE_SIZE = isNativeApp()
  ? STANDARD_MESSAGE_FETCH_PAGE_SIZE
  : LARGE_MESSAGE_FETCH_PAGE_SIZE;

async function updatePostInCache(
  variables: { nest: Nest; postId: string },
  updater: (post: PostDataResponse | undefined) => PostDataResponse | undefined
) {
  const [han, flag] = nestToFlag(variables.nest);
  await queryClient.cancelQueries([han, 'posts', flag, variables.postId]);

  queryClient.setQueryData([han, 'posts', flag, variables.postId], updater);
}

interface PostsInCachePrev {
  pages: PagedPosts[];
  pageParams: PageParam[];
}

async function updatePostsInCache(
  variables: { nest: Nest },
  updater: (
    prev: PostsInCachePrev | undefined
  ) => { pageParams: PageParam[]; pages: PagedPosts[] } | undefined
) {
  const [han, flag] = nestToFlag(variables.nest);
  await queryClient.cancelQueries([han, 'posts', flag, 'infinite']);

  queryClient.setQueryData([han, 'posts', flag, 'infinite'], updater);
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

export type PostStatus = 'pending' | 'sent' | 'delivered';

export interface TrackedPost {
  cacheId: CacheId;
  status: PostStatus;
}

export interface State {
  trackedPosts: TrackedPost[];
  addTracked: (id: CacheId) => void;
  addSent: (ids: CacheId[]) => void;
  updateStatus: (id: CacheId, status: PostStatus) => void;
  getStatus: (id: CacheId) => PostStatus;
  [key: string]: unknown;
}

export const usePostsStore = create<State>((set, get) => ({
  trackedPosts: [],
  addTracked: (id) => {
    set((state) => ({
      trackedPosts: [{ status: 'pending', cacheId: id }, ...state.trackedPosts],
    }));
  },
  addSent: (ids) => {
    set((state) => ({
      trackedPosts: [
        ...ids.map((id) => ({ status: 'sent' as PostStatus, cacheId: id })),
        ...state.trackedPosts,
      ],
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
  getStatus: (id) => {
    const { trackedPosts } = get();

    const post = trackedPosts.find(
      ({ cacheId }) => cacheId.author === id.author && cacheId.sent === id.sent
    );

    return post?.status ?? 'delivered';
  },
}));

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

export function useIsPostUndelivered(post: Post | undefined) {
  const stubbedCacheId = { author: '~zod', sent: 0 };
  const cacheId =
    post && post.essay
      ? { author: post.essay.author, sent: post.essay.sent }
      : stubbedCacheId;
  const status = useTrackedPostStatus(cacheId);
  return status !== 'delivered';
}

export function usePostsOnHost(
  nest: Nest,
  enabled: boolean
): Posts | undefined {
  const [han, flag] = nestToFlag(nest);
  const { data } = useReactQueryScry({
    queryKey: [han, 'posts', 'live', flag],
    app: 'channels',
    path: `/v1/${nest}/posts/newest/${STANDARD_MESSAGE_FETCH_PAGE_SIZE}/outline`,
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

const infinitePostUpdater = (
  prev: PostsInCachePrev | undefined,
  data: ChannelsResponse
): PostsInCachePrev | undefined => {
  const { nest, response } = data;

  if (!('post' in response)) {
    return prev;
  }

  const infinitePostQueryKey = infinitePostsKey(nest);
  const existingQueryData = queryClient.getQueryData<
    PostsInCachePrev | undefined
  >(infinitePostQueryKey);
  if (!shouldAddPostToCache(existingQueryData)) {
    return prev;
  }

  const postResponse = response.post['r-post'];
  const { id } = response.post;
  const time = decToUd(id);

  if ('set' in postResponse) {
    const post = postResponse.set;

    if (post === null) {
      if (prev === undefined) {
        return prev;
      }

      const newPages = prev.pages.map((page) => {
        const newPage = {
          ...page,
        };

        const inPage =
          Object.keys(newPage.posts).some((k) => k === time) ?? false;

        if (inPage) {
          const pagePosts = { ...newPage.posts };

          pagePosts[time] = null;

          newPage.posts = pagePosts;
        }

        return newPage;
      });

      return {
        pages: newPages,
        pageParams: prev.pageParams,
      };
    }
    if (prev === undefined) {
      return {
        pages: [
          {
            posts: {
              [time]: post,
            },
            newer: null,
            older: null,
            total: 1,
          },
        ],
        pageParams: [],
      };
    }

    const firstPage = _.first(prev.pages);

    if (firstPage === undefined) {
      return undefined;
    }

    const newPosts = {
      ...firstPage.posts,
      [time]: post,
    };

    const newFirstpage: PagedPosts = {
      ...firstPage,
      posts: newPosts,
      total: firstPage.total + 1,
    };

    const cachedPost =
      firstPage.posts[decToUd(unixToDa(post.essay.sent).toString())];

    if (cachedPost && id !== udToDec(unixToDa(post.essay.sent).toString())) {
      // remove cached post if it exists
      delete newFirstpage.posts[decToUd(unixToDa(post.essay.sent).toString())];

      // set delivered now that we have the real post
      usePostsStore
        .getState()
        .updateStatus(
          { author: post.essay.author, sent: post.essay.sent },
          'delivered'
        );
    }

    return {
      pages: [newFirstpage, ...prev.pages.slice(1, prev.pages.length)],
      pageParams: prev.pageParams,
    };
  }

  if ('reacts' in postResponse) {
    if (prev === undefined) {
      return undefined;
    }

    const { reacts } = postResponse;

    const newPages = prev.pages.map((page) => {
      const newPage = {
        ...page,
      };

      const inPage =
        Object.keys(newPage.posts).some((k) => k === time) ?? false;

      if (inPage) {
        const post = newPage.posts[time];
        if (!post) {
          return newPage;
        }
        newPage.posts[time] = {
          ...post,
          seal: {
            ...post.seal,
            reacts,
          },
        };

        return newPage;
      }

      return newPage;
    });

    return {
      pages: newPages,
      pageParams: prev.pageParams,
    };
  }

  if ('essay' in postResponse) {
    if (prev === undefined) {
      return undefined;
    }

    const { essay } = postResponse;

    const newPages = prev.pages.map((page) => {
      const newPage = {
        ...page,
      };

      const inPage =
        Object.keys(newPage.posts).some((k) => k === time) ?? false;

      if (inPage) {
        const post = newPage.posts[time];
        if (!post) {
          return page;
        }
        newPage.posts[time] = {
          ...post,
          essay,
        };

        return newPage;
      }

      return newPage;
    });

    return {
      pages: newPages,
      pageParams: prev.pageParams,
    };
  }

  return prev;
};

function updateReplyMetaData(
  cache: PostsInCachePrev | undefined,
  cacheId: string,
  meta: ReplyMeta
): PostsInCachePrev | undefined {
  if (!cache) {
    return undefined;
  }

  const newPages = cache.pages.map((page) => {
    const newPage = {
      ...page,
    };

    const inPage =
      Object.keys(newPage.posts).some((k) => k === cacheId) ?? false;

    if (inPage) {
      const post = newPage.posts[cacheId];
      if (!post) {
        return newPage;
      }
      newPage.posts[cacheId] = {
        ...post,
        seal: {
          ...post.seal,
          meta: {
            ...post.seal.meta,
            ...meta,
          },
        },
      };

      return newPage;
    }

    return newPage;
  });

  return {
    pages: newPages,
    pageParams: cache.pageParams,
  };
}

const replyUpdater = (
  prev: PostDataResponse | undefined,
  data: ChannelsResponse
): PostDataResponse | undefined => {
  const { nest, response } = data;

  if (!('post' in response)) {
    return prev;
  }

  const postResponse = response.post['r-post'];
  const { id } = response.post;
  const time = decToUd(id);

  if (!('reply' in postResponse)) {
    return prev;
  }

  const {
    reply: {
      meta: { replyCount, lastReply, lastRepliers },
      'r-reply': reply,
    },
  } = postResponse;

  // const [han, flag] = nestToFlag(nest);

  // const replyQueryKey = [han, 'posts', flag, udToDec(time.toString())];
  if (reply && !('set' in reply)) {
    return prev;
  }

  if (reply.set === null) {
    if (prev === undefined) {
      return undefined;
    }

    const existingReplies = prev.seal.replies ?? {};

    const newReplies = Object.keys(existingReplies)
      .filter((k) => k !== reply.set?.seal.id)
      .reduce(
        (acc, k) => {
          // eslint-disable-next-line no-param-reassign
          acc[k] = existingReplies[k];
          return acc;
        },
        {} as { [key: string]: Reply }
      );

    const newPost = {
      ...prev,
      seal: {
        ...prev.seal,
        replies: newReplies,
        meta: {
          ...prev.seal.meta,
          replyCount,
          lastReply,
          lastRepliers,
        },
      },
    };

    return newPost;
  }

  if ('memo' in reply.set) {
    const newReply = reply.set;
    if (prev === undefined) {
      return undefined;
    }

    const existingReplies = prev.seal.replies ?? {};

    const existingCachedReply =
      existingReplies[decToUd(unixToDa(newReply.memo.sent).toString())];

    if (existingCachedReply) {
      // remove cached reply if it exists
      delete existingReplies[decToUd(unixToDa(newReply.memo.sent).toString())];
    }

    const newReplies = {
      ...existingReplies,
      [decToUd(newReply.seal.id)]: newReply,
    };

    const newPost = {
      ...prev,
      seal: {
        ...prev.seal,
        replies: newReplies,
        meta: {
          ...prev.seal.meta,
          replyCount,
          lastReply,
          lastRepliers,
        },
      },
    };

    usePostsStore.getState().updateStatus(
      {
        author: newReply.memo.author,
        sent: newReply.memo.sent,
      },
      'delivered'
    );

    return newPost;
  }

  return prev;
};

type PageParam = null | {
  time: string;
  direction: string;
};

export const infinitePostQueryFn =
  (nest: Nest, initialTime?: string) =>
  async ({ pageParam }: { pageParam?: PageParam }) => {
    let path = '';

    if (pageParam) {
      const { time, direction } = pageParam;
      const ud = decToUd(time);
      path = `/v1/${nest}/posts/${direction}/${ud}/${POST_PAGE_SIZE}/outline`;
    } else if (initialTime) {
      path = `/v1/${nest}/posts/around/${decToUd(initialTime)}/${
        POST_PAGE_SIZE / 2
      }/outline`;
    } else {
      path = `/v1/${nest}/posts/newest/${POST_PAGE_SIZE}/outline`;
    }

    const response = await api.scry<PagedPosts>({
      app: 'channels',
      path,
    });

    return {
      ...response,
    };
  };

export function useInfinitePosts(nest: Nest, initialTime?: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = useMemo(() => [han, 'posts', flag, 'infinite'], [han, flag]);
  const pending = usePendingPosts(nest);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const { posts, replies } = pending;
    const postIds: CacheId[] = Object.keys(posts).map(cacheIdFromString);
    const replyIds: CacheId[] = Object.entries(replies).reduce(
      (entries, [, rs]) => {
        return [...entries, ...Object.keys(rs).map(cacheIdFromString)];
      },
      [] as CacheId[]
    );
    usePostsStore.getState().addSent([...postIds, ...replyIds]);
  }, [pending]);

  const { data, ...rest } = useInfiniteQuery<PagedPosts>({
    queryKey,
    queryFn: infinitePostQueryFn(nest, initialTime),
    getNextPageParam: (lastPage): PageParam | undefined => {
      const { older } = lastPage;

      if (!older) {
        return undefined;
      }

      return {
        time: older,
        direction: 'older',
      };
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      const { newer } = firstPage;

      if (!newer) {
        return undefined;
      }

      return {
        time: newer,
        direction: 'newer',
      };
    },
    refetchOnMount: true,
    retryOnMount: true,
    retry: false,
  });

  const merged = useMemo(() => {
    if (!data) {
      return undefined;
    }

    const pendingPosts = _.fromPairs(
      Object.entries(pending?.posts ?? {}).map(([id, essay]) => {
        const { sent } = cacheIdFromString(id);
        const synthId = unixToDa(sent).toString();
        return [
          decToUd(synthId),
          {
            seal: {
              id: synthId,
              reacts: {},
              replies: [],
              meta: {
                replyCount: 0,
                lastRepliers: [],
                lastReply: null,
              },
            },
            essay,
            revision: '0',
          } as Post,
        ];
      })
    );

    return {
      ...data,
      pages: data.pages.map((page, index) => {
        if (index !== 0) {
          return page;
        }

        return {
          ...page,
          posts: {
            ...page.posts,
            ...pendingPosts,
          },
        };
      }),
    };
  }, [data, pending]);

  const posts = newPostTupleArray(merged);

  return {
    data,
    posts,
    ...rest,
  };
}

function removePostFromInfiniteQuery(nest: string, time: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = [han, 'posts', flag, 'infinite'];
  const deletedId = decToUd(time);
  const currentData = queryClient.getQueryData(queryKey) as any;
  const newPages =
    currentData?.pages.map((page: any) => {
      if (Array.isArray(page)) {
        return page.filter(([id]: any) => id !== deletedId);
      }

      return page;
    }) ?? [];
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
    path: `/v1/${nest}/posts/post/${ud}`,
  })) as Post;
  if (data) {
    queryClient.setQueryData([han, nest, 'posts', time, 'withComments'], data);
  }
}

export function useReplyPost(nest: Nest, id: string | null) {
  const { posts } = useInfinitePosts(nest);

  return id && posts.find(([k, _v]) => k.eq(bigInt(id)));
}

export function useOrderedPosts(
  nest: Nest,
  currentId: bigInt.BigInteger | string
) {
  checkNest(nest);
  const { posts } = useInfinitePosts(nest);

  if (posts.length === 0) {
    return {
      nextPost: null,
      prevPost: null,
      sortedOutlines: [],
    };
  }

  const sortedOutlines = posts
    .filter(([, v]) => v !== null)
    .sort(([a], [b]) => b.compare(a));
  const postId = typeof currentId === 'string' ? bigInt(currentId) : currentId;
  const currentIdx = sortedOutlines.findIndex(([i, _c]) => i.eq(postId));

  const nextPost = currentIdx > 0 ? sortedOutlines[currentIdx - 1] : null;
  if (nextPost) {
    prefetchPostWithComments({
      nest,
      time: udToDec(nextPost[0].toString()),
    });
  }
  const prevPost =
    currentIdx < sortedOutlines.length - 1
      ? sortedOutlines[currentIdx + 1]
      : null;
  if (prevPost) {
    prefetchPostWithComments({
      nest,
      time: udToDec(prevPost[0].toString()),
    });
  }

  return {
    nextPost,
    prevPost,
    sortedOutlines,
  };
}

type PostsUpdater = (
  prev: PendingMessages['posts']
) => PendingMessages['posts'];
type RepliesUpdater = (
  prev: PendingMessages['replies']
) => PendingMessages['replies'];

function updatePendingMsgs(
  nest: Nest,
  postUpdater: PostsUpdater,
  repliesUpdater: RepliesUpdater
) {
  queryClient.setQueryData<Channels>(channelKey(), (channels?: Channels) => {
    const channel = channels?.[nest];
    if (!channel) {
      return channels;
    }

    const { pending, ...rest } = channel;
    const newChannel = {
      ...rest,
      pending: {
        posts: postUpdater(pending.posts),
        replies: repliesUpdater(pending.replies),
      },
    };

    return {
      ...channels,
      [nest]: newChannel,
    };
  });
}

export function useChannelsFirehose() {
  const [eventQueue, setEventQueue] = useState<ChannelsSubscribeResponse[]>([]);
  const eventProcessor = useCallback((events: ChannelsSubscribeResponse[]) => {
    const hideEvents = events.filter((e) => 'hide' in e).map((e) => e.hide);
    if (hideEvents.length > 0) {
      queryClient.setQueryData<HiddenPosts>(
        ['channels', 'hidden'],
        (d: HiddenPosts = []) => [...d, ...hideEvents]
      );
    }

    const showEvents = events.filter((e) => 'show' in e).map((e) => e.show);
    if (showEvents.length > 0) {
      queryClient.setQueryData<HiddenPosts>(
        ['channels', 'hidden'],
        (d: HiddenPosts = []) => [...d, ...showEvents]
      );
    }

    const pendingEvents = events.filter(
      (e) => 'response' in e && 'pending' in e.response
    ) as ChannelsResponse[];
    const channelPendingEvents = Object.entries(
      _.groupBy(pendingEvents, 'nest')
    );
    if (pendingEvents.length > 0) {
      const { trackedPosts } = usePostsStore.getState();
      const newPosts: PendingMessages['posts'] = {};
      const newReplies: PendingMessages['replies'] = {};
      channelPendingEvents.forEach(([nest, es]) => {
        es.forEach((event) => {
          const { response } = event;
          if (!('pending' in response)) {
            return;
          }

          const cacheId = response.pending.id;
          const isPending = trackedPosts.some(
            (p) =>
              p.status === 'pending' &&
              p.cacheId.author === cacheId.author &&
              p.cacheId.sent === cacheId.sent
          );
          if (isPending) {
            usePostsStore.getState().updateStatus(cacheId, 'sent');
          }

          if ('post' in response.pending.pending) {
            newPosts[cacheIdToString(cacheId)] = response.pending.pending.post;
          }

          if ('reply' in response.pending.pending) {
            const { top } = response.pending.pending.reply;
            const replies = newReplies[top] || {};
            newReplies[top] = {
              ...replies,
              [cacheIdToString(cacheId)]: response.pending.pending.reply.memo,
            };
          }
        });

        // updatePendingMsgs(
        //   nest,
        //   (prev) => ({
        //     ...prev,
        //     ...newPosts,
        //   }),
        //   (prev) => _.merge(prev, newReplies)
        // );
        queryClient.setQueryData<Channels>(
          channelKey(),
          (channels?: Channels) => {
            const channel = channels?.[nest];
            if (!channel) {
              return channels;
            }

            const { pending, ...rest } = channel;
            const newChannel = {
              ...rest,
              pending: {
                posts: {
                  ...pending.posts,
                  ...newPosts,
                },
                replies: _.merge(pending.replies, newReplies),
              },
            };

            return {
              ...channels,
              [nest]: newChannel,
            };
          }
        );
      });
    }

    const postEvents = events.filter(
      (e) =>
        'response' in e &&
        'post' in e.response &&
        !('reply' in e.response.post['r-post'])
    );
    if (postEvents.length > 0) {
      const channelPostEvents = Object.entries(
        _.groupBy(postEvents, (event: ChannelsSubscribeResponse) => event.nest)
      );
      channelPostEvents.forEach(([nest, es]) => {
        const key = infinitePostsKey(nest);
        const existingQueryData = queryClient.getQueryData<
          PostsInCachePrev | undefined
        >(key);
        const newData = es.reduce(
          (prev, event) => infinitePostUpdater(prev, event),
          existingQueryData
        );
        queryClient.setQueryData(key, newData);
      });
    }

    const replyEvents = events.filter(
      (e) =>
        'response' in e &&
        'post' in e.response &&
        'reply' in e.response.post['r-post']
    );
    if (replyEvents.length > 0) {
      const channelReplyEvents = Object.entries(
        _.groupBy(replyEvents, (event: ChannelsSubscribeResponse) => {
          if (!('post' in event.response)) {
            return undefined;
          }

          const { nest } = event;
          const { id } = event.response.post;
          const time = decToUd(id);
          return postKey(nest, time).join();
        })
      );

      channelReplyEvents.forEach(([, es]) => {
        const event = es[0];
        if (!event || !('response' in event) || !('post' in event.response)) {
          return;
        }

        const postResponse = event.response.post['r-post'];
        const { id } = event.response.post;
        const { nest } = event;
        const time = decToUd(id);
        const key = postKey(nest, time);
        const existingQueryData = queryClient.getQueryData<
          PostDataResponse | undefined
        >(key);
        const newData = es.reduce(
          (prev, e) => replyUpdater(prev, e),
          existingQueryData
        );
        queryClient.setQueryData(key, newData);

        if (!('reply' in postResponse)) {
          return;
        }

        const {
          reply: { meta },
        } = postResponse;
        queryClient.setQueryData<PostsInCachePrev | undefined>(
          infinitePostsKey(nest),
          (d) => updateReplyMetaData(d, time, meta)
        );
      });
    }

    const groupedEvents = _.groupBy([...postEvents, ...replyEvents], 'nest');
    queryClient.setQueryData<Channels>(channelKey(), (channels?: Channels) => {
      if (!channels) {
        return channels;
      }

      return _.fromPairs(
        Object.entries(channels).map(([nest, channel]) => {
          const { pending, ...rest } = channel;
          const evs = groupedEvents[nest] || [];
          return [
            nest,
            {
              ...rest,
              pending: {
                posts: _.fromPairs(
                  Object.entries(pending.posts).filter(([id]) =>
                    evs.some((e) => {
                      if (!('response' in e)) {
                        return false;
                      }

                      if (
                        'post' in e.response &&
                        'set' in e.response.post['r-post']
                      ) {
                        const { set } = e.response.post['r-post'];
                        return set ? id === cacheIdToString(set.essay) : false;
                      }

                      return false;
                    })
                  )
                ),
                replies: _.fromPairs(
                  Object.entries(pending.replies).map(([top, rs]) => {
                    return [
                      top,
                      _.fromPairs(
                        Object.entries(rs).filter(([id]) =>
                          evs.some((e) => {
                            if (!('response' in e)) {
                              return false;
                            }

                            if (
                              'post' in e.response &&
                              'reply' in e.response.post['r-post'] &&
                              'set' in
                                e.response.post['r-post'].reply['r-reply']
                            ) {
                              const { set } =
                                e.response.post['r-post'].reply['r-reply'];
                              return set
                                ? id === cacheIdToString(set.memo)
                                : false;
                            }

                            return false;
                          })
                        )
                      ),
                    ];
                  })
                ),
              },
            },
          ];
        })
      );
    });

    setEventQueue([]);
  }, []);

  const eventHandler = useCallback((event: ChannelsSubscribeResponse) => {
    setEventQueue((prev) => [...prev, event]);
  }, []);

  useEffect(() => {
    api.subscribe({
      app: 'channels',
      path: '/v1',
      event: eventHandler,
    });
  }, [eventHandler]);

  const processQueue = useRef(
    _.debounce(
      (events: ChannelsSubscribeResponse[]) => {
        eventProcessor(events);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  useEffect(() => {
    if (eventQueue.length === 0) {
      return;
    }

    processQueue.current(eventQueue);
  }, [eventQueue]);
}

const emptyChannels: Channels = {};
export function useChannels(): Channels {
  const { data, ...rest } = useReactQueryScry<Channels>({
    queryKey: channelKey(),
    app: 'channels',
    path: '/channels',
    options: {
      // refetchOnMount: false,
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

  const scryPath = useMemo(
    () => `/v1/${nest}/posts/post/${decToUd(postId)}`,
    [nest, postId]
  );

  const subPath = useMemo(() => `/v1/${nest}`, [nest]);

  const enabled = useMemo(
    () => postId !== '0' && postId !== '' && nest !== '' && !disabled,
    [postId, nest, disabled]
  );
  const pending = usePendingPosts(nest);
  const { data, ...rest } = useReactQuerySubscription({
    queryKey,
    app: 'channels',
    scry: scryPath,
    path: subPath,
    options: {
      enabled,
    },
  });

  const post = data as PostDataResponse;

  const replies = post?.seal?.replies;
  const pendingReplies = Object.entries(
    (pending.replies ? pending.replies[postId] : undefined) || {}
  ).map(([id, memo]) => {
    const { sent } = cacheIdFromString(id);
    const realId = unixToDa(sent);
    const reply: Reply = {
      seal: {
        id: realId.toString(),
        reacts: {},
        'parent-id': postId,
      },
      memo,
    };
    return [realId, reply] as ReplyTuple;
  });
  if (replies === undefined || Object.entries(replies).length === 0) {
    return {
      post: {
        ...post,
        seal: {
          ...post?.seal,
          replies: [...pendingReplies] as ReplyTuple[],
          lastReply: null,
        },
      },
      ...rest,
    };
  }

  const diff: ReplyTuple[] = Object.entries(replies).map(([k, v]) => [
    bigInt(udToDec(k)),
    v as Reply,
  ]);

  const postWithReplies: Post = {
    ...post,
    seal: {
      ...post?.seal,
      replies: [...diff, ...pendingReplies],
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
    if (post.seal.replies === null || post.seal.replies.length === undefined) {
      return undefined;
    }
    const reply = post.seal.replies.find(
      ([k]) => k.toString() === replyId
    )?.[1];
    return reply;
  }, [post, replyId]);
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

const emptyUnreads: Unreads = {};
export function useUnreads(): Unreads {
  const { mutate: markRead } = useMarkReadMutation();
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
    const { nest, unread } = event;

    if (unread !== null) {
      const [app, flag] = nestToFlag(nest);

      if (app === 'chat') {
        useChatStore
          .getState()
          .handleUnread(flag, unread, () => markRead({ nest: `chat/${flag}` }));
      }

      queryClient.setQueryData(['unreads'], (d: Unreads | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const newUnreads = { ...d };
        newUnreads[event.nest] = unread;

        return newUnreads;
      });
    }

    invalidate.current();
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

export function useChatStoreChannelUnreads() {
  const chats = useChatStore((s) => s.chats);

  return useMemo(
    () =>
      Object.entries(chats).reduce((acc, [k, v]) => {
        if (whomIsFlag(k)) {
          const { unread } = v;

          if (unread && !unread.seen) {
            acc.push(k);
          }
        }
        return acc;
      }, [] as string[]),
    [chats]
  );
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

const emptyPending: PendingMessages = {
  posts: {},
  replies: {},
};
export function usePendingPosts(nest: Nest) {
  const channel = useChannel(nest);
  return channel?.pending || emptyPending;
}

export function useIsSentPost(nest: Nest, cacheId: CacheId) {
  const pending = usePendingPosts(nest);
  return pending.posts[cacheIdToString(cacheId)] !== undefined;
}

export function useIsSentReply(nest: Nest, parent: string, cacheId: CacheId) {
  const pending = usePendingPosts(nest);
  return pending.replies[parent]?.[cacheIdToString(cacheId)] !== undefined;
}

export function useRemotePost(
  nest: Nest,
  id: string,
  blockLoad: boolean,
  replyId?: string
) {
  checkNest(nest);
  const [han, _flag] = nestToFlag(nest);
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

  if (rest.isLoading || rest.isError || data === undefined) {
    return {
      reference: undefined,
      ...rest,
    };
  }

  if (data === null) {
    return {
      reference: null,
      ...rest,
    };
  }

  const { reference } = data as Said;

  return {
    reference,
    ...rest,
  };
}

export function usePostKeys(nest: Nest) {
  const { posts } = useInfinitePosts(nest);

  return useMemo(() => posts.map(([k]) => k), [posts]);
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
      { app: 'channels', path: '/v1' },
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
      await queryClient.cancelQueries(channelKey());
      await queryClient.cancelQueries(['unreads']);
      await queryClient.cancelQueries([han, 'perms', flag]);
      await queryClient.cancelQueries([han, 'posts', flag]);
      queryClient.removeQueries([han, 'perms', flag]);
      queryClient.removeQueries([han, 'posts', flag]);
    },
    onSettled: async (_data, _error) => {
      await queryClient.invalidateQueries(channelKey());
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
      await queryClient.cancelQueries(channelKey());

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(channelKey(), {
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

      await queryClient.cancelQueries(channelKey());

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(channelKey(), {
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
      await queryClient.cancelQueries(channelKey());

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(channelKey(), {
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
    tracked?: boolean;
  }) => {
    if (!variables.tracked) {
      // If we use a trackedPoke here then the trackedPost status will be updated
      // out of order. So we use a normal poke.
      return api.poke(
        channelPostAction(nest, {
          add: variables.essay,
        })
      );
    }

    // for diary notes, we want to wait for the post to get an ID back from the backend.
    return asyncCallWithTimeout(
      new Promise<string>((resolve) => {
        try {
          api
            .trackedPoke<ChannelsAction, ChannelsResponse>(
              channelPostAction(nest, {
                add: variables.essay,
              }),
              { app: 'channels', path: `/v1/${nest}` },
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
          // eslint-disable-next-line no-console
          console.error(e);
        }
      }),
      15000
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(queryKey());

      usePostsStore.getState().addTracked(variables.cacheId);

      const sent = unixToDa(variables.essay.sent).toString();
      const post = {
        seal: {
          id: sent,
          replies: {},
          reacts: {},
          meta: {
            replyCount: 0,
            lastRepliers: [],
            lastReply: null,
          },
        },
        essay: variables.essay,
      };

      queryClient.setQueryData<PostDataResponse>(
        queryKey(variables.cacheId),
        post
      );

      const existingQueryData = queryClient.getQueryData<
        PostsInCachePrev | undefined
      >(queryKey('infinite'));
      const newData = infinitePostUpdater(existingQueryData, {
        nest,
        response: {
          post: {
            id: sent,
            'r-post': {
              set: {
                ...post,
                seal: {
                  ...post.seal,
                  replies: null,
                },
              },
            },
          },
        },
      });
      queryClient.setQueryData(queryKey('infinite'), newData);
    },
    onSuccess: async (_data, variables) => {
      queryClient.removeQueries(queryKey(variables.cacheId));
    },
    onError: async (_error, variables) => {
      usePostsStore.setState((state) => ({
        ...state,
        trackedPosts: state.trackedPosts.filter(
          (p) => p.cacheId !== variables.cacheId
        ),
      }));

      queryClient.setQueryData(queryKey(variables.cacheId), undefined);
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

    asyncCallWithTimeout(
      api.poke(
        channelPostAction(variables.nest, {
          edit: {
            id: decToUd(variables.time),
            essay: variables.essay,
          },
        })
      ),
      15000
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: PostDataResponse | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        return {
          ...prev,
          essay: variables.essay,
        };
      };

      const postsUpdater = (prev: PostsInCachePrev | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        if (prev.pages === undefined) {
          return prev;
        }

        const allPostsInCache = prev.pages.flatMap((page) =>
          Object.entries(page.posts)
        );

        const prevPost = allPostsInCache.find(
          ([k]) => k === decToUd(variables.time)
        )?.[1];

        if (prevPost === null || prevPost === undefined) {
          return prev;
        }

        const pageInCache = prev.pages.find((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.time))
        );

        const pageInCacheIdx = prev.pages.findIndex((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.time))
        );

        if (pageInCache === undefined) {
          return prev;
        }

        return {
          ...prev,
          pages: [
            ...prev.pages.slice(0, pageInCacheIdx),
            {
              ...pageInCache,
              posts: {
                ...pageInCache?.posts,
                [decToUd(variables.time)]: {
                  ...prevPost,
                  essay: variables.essay,
                  seal: prevPost.seal,
                },
              },
            },
            ...prev.pages.slice(pageInCacheIdx + 1),
          ],
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
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries({
        queryKey: [han, 'posts', flag, variables.time],
        refetchType: 'none',
      });
      await queryClient.invalidateQueries({
        queryKey: [han, 'posts', flag, 'infinite'],
      });
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
        path: `/v1/${variables.nest}`,
      },
      (event) => {
        if ('post' in event.response) {
          const { id, 'r-post': postResponse } = event.response.post;
          return (
            decToUd(id) === variables.time &&
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
      const updater = (prev: PostsInCachePrev | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        if (prev.pages === undefined) {
          return prev;
        }

        const allPostsInCache = prev.pages.flatMap((page) =>
          Object.entries(page.posts)
        );

        const prevPost = allPostsInCache.find(
          ([k]) => k === decToUd(variables.time)
        )?.[1];

        if (prevPost === null || prevPost === undefined) {
          return prev;
        }

        const pageInCache = prev.pages.find((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.time))
        );

        const pageInCacheIdx = prev.pages.findIndex((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.time))
        );

        if (pageInCache === undefined) {
          return prev;
        }

        return {
          ...prev,
          pages: [
            ...prev.pages.slice(0, pageInCacheIdx),
            {
              ...pageInCache,
              posts: Object.fromEntries(
                Object.entries(pageInCache.posts).filter(
                  ([k]) => k !== decToUd(variables.time)
                )
              ),
            },
            ...prev.pages.slice(pageInCacheIdx + 1),
          ],
        };
      };

      await updatePostsInCache(variables, updater);
    },
    onSuccess: async (_data, variables) => {
      removePostFromInfiniteQuery(variables.nest, variables.time);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      setTimeout(async () => {
        await queryClient.invalidateQueries([han, 'posts', flag]);
        await queryClient.invalidateQueries([han, 'posts', flag, 'infinite']);
      }, 3000);
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
      { app: 'channels', path: '/v1' },
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
      await queryClient.cancelQueries(channelKey());

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(channelKey(), {
          ...prev,
          [`${variables.kind}/${window.our}/${variables.name}`]: {
            perms: { writers: [], group: variables.group },
            view: 'list',
            order: [],
            sort: 'time',
            pending: emptyPending,
          },
        });
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries(channelKey());
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

      await queryClient.cancelQueries(channelKey());

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(channelKey(), {
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
      await queryClient.cancelQueries(channelKey());

      const prev = queryClient.getQueryData<{ [nest: Nest]: Channel }>([
        'channels',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Channel }>(channelKey(), {
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
    memo: Memo;
    cacheId: CacheId;
  }) => {
    checkNest(variables.nest);

    const replying = decToUd(variables.postId);
    const action: Action = {
      post: {
        reply: {
          id: replying,
          action: {
            add: variables.memo,
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      usePostsStore.getState().addTracked(variables.cacheId);

      const postsUpdater = (prev: PostsInCachePrev | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const replying = decToUd(variables.postId);

        const allPostsInCache = prev.pages.flatMap((page) =>
          Object.entries(page.posts)
        );

        if (replying in allPostsInCache) {
          const replyingPost = allPostsInCache.find(
            ([k]) => k === replying
          )?.[1];
          if (replyingPost === null || replyingPost === undefined) {
            return prev;
          }

          const updatedPost = {
            ...replyingPost,
            seal: {
              ...replyingPost.seal,
              meta: {
                ...replyingPost.seal.meta,
                replyCount: replyingPost.seal.meta.replyCount + 1,
                repliers: [...replyingPost.seal.meta.lastRepliers, window.our],
              },
            },
          };

          const pageInCache = prev.pages.find((page) =>
            Object.keys(page.posts).some((k) => k === decToUd(replying))
          );

          const pageInCacheIdx = prev.pages.findIndex((page) =>
            Object.keys(page.posts).some((k) => k === decToUd(replying))
          );

          if (pageInCache === undefined) {
            return prev;
          }

          return {
            ...prev,
            pages: [
              ...prev.pages.slice(0, pageInCacheIdx),
              {
                ...pageInCache,
                posts: {
                  ...pageInCache?.posts,
                  [decToUd(replying)]: updatedPost,
                },
              },
              ...prev.pages.slice(pageInCacheIdx + 1),
            ],
          };
        }
        return prev;
      };

      const updater = (prevPost: PostDataResponse | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }
        const prevReplies = prevPost.seal.replies;
        const newReplies: Record<string, Reply> = {
          ...prevReplies,
          [decToUd(unixToDa(variables.memo.sent).toString())]: {
            seal: {
              id: unixToDa(variables.memo.sent).toString(),
              'parent-id': variables.postId,
              reacts: {},
            },
            memo: variables.memo,
          },
        };

        const updatedPost: PostDataResponse = {
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
    onSuccess: async (_data, variables) => {
      const status = usePostsStore.getState().getStatus(variables.cacheId);
      if (status === 'pending') {
        usePostsStore.getState().updateStatus(variables.cacheId, 'sent');
      }
    },
  });
}

export function useEditReplyMutation() {
  const mutationFn = async (variables: {
    nest: Nest;
    postId: string;
    replyId: string;
    memo: Memo;
  }) => {
    checkNest(variables.nest);

    const replying = decToUd(variables.postId);
    const action: Action = {
      post: {
        reply: {
          id: replying,
          action: {
            edit: {
              id: decToUd(variables.replyId),
              memo: variables.memo,
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
      const updater = (prevPost: PostDataResponse | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }

        const replyId = decToUd(variables.replyId);

        const prevReplies = prevPost.seal.replies;
        const newReplies = { ...prevReplies };
        newReplies[replyId] = {
          seal: {
            id: variables.replyId,
            'parent-id': variables.postId,
            reacts: {},
          },
          memo: variables.memo,
        };

        const updatedPost: PostDataResponse = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            replies: newReplies,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, updater);
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
      const postsUpdater = (prev: PostsInCachePrev | undefined) => {
        if (prev === undefined) {
          return prev;
        }
        const replying = decToUd(variables.postId);

        const allPostsInCache = prev.pages.flatMap((page) =>
          Object.entries(page.posts)
        );

        if (replying in allPostsInCache) {
          const replyingPost = allPostsInCache.find(
            ([k]) => k === replying
          )?.[1];

          if (replyingPost === null || replyingPost === undefined) {
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

          const pageInCache = prev.pages.find((page) =>
            Object.keys(page.posts).some((k) => k === decToUd(replying))
          );

          const pageInCacheIdx = prev.pages.findIndex((page) =>
            Object.keys(page.posts).some((k) => k === decToUd(replying))
          );

          if (pageInCache === undefined) {
            return prev;
          }

          return {
            ...prev,
            pages: [
              ...prev.pages.slice(0, pageInCacheIdx),
              {
                ...pageInCache,
                posts: {
                  ...pageInCache?.posts,
                  [decToUd(replying)]: updatedPost,
                },
              },
              ...prev.pages.slice(pageInCacheIdx + 1),
            ],
          };
        }
        return prev;
      };

      const updater = (prevPost: PostDataResponse | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }

        const prevReplies = prevPost.seal.replies;
        const newReplies = { ...prevReplies };
        delete newReplies[variables.replyId];

        const updatedPost: PostDataResponse = {
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
      setTimeout(async () => {
        // TODO: this is a hack to make sure the post is updated before refetching
        // the queries. We need to figure out why the post is not updated immediately.
        await queryClient.refetchQueries([
          han,
          'posts',
          flag,
          variables.postId,
        ]);
      }, 300);
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
      const postsUpdater = (prev: PostsInCachePrev | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const allPostsInCache = prev.pages.flatMap((page) =>
          Object.entries(page.posts)
        );

        const prevPost = allPostsInCache.find(
          ([k]) => k === decToUd(variables.postId)
        )?.[1];

        if (prevPost === null || prevPost === undefined) {
          return prev;
        }

        const updatedPost = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            reacts: {
              ...prevPost.seal.reacts,
              [window.our]: variables.react,
            },
          },
        };

        const pageInCache = prev.pages.find((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.postId))
        );

        const pageInCacheIdx = prev.pages.findIndex((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.postId))
        );

        if (pageInCache === undefined) {
          return prev;
        }

        return {
          ...prev,
          pages: [
            ...prev.pages.slice(0, pageInCacheIdx),
            {
              ...pageInCache,
              posts: {
                ...pageInCache?.posts,
                [decToUd(variables.postId)]: updatedPost,
              },
            },
            ...prev.pages.slice(pageInCacheIdx + 1),
          ],
        };
      };

      const postUpdater = (prevPost: PostDataResponse | undefined) => {
        if (prevPost === undefined) {
          return prevPost;
        }

        const prevReacts = prevPost.seal.reacts;
        const newReacts = {
          ...prevReacts,
          [window.our]: variables.react,
        };

        const updatedPost: PostDataResponse = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            reacts: newReacts,
          },
        };

        return updatedPost;
      };

      await updatePostInCache(variables, postUpdater);

      await updatePostsInCache(variables, postsUpdater);
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
      const postsUpdater = (prev: PostsInCachePrev | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const allPostsInCache = prev.pages.flatMap((page) =>
          Object.entries(page.posts)
        );

        const prevPost = allPostsInCache.find(
          ([k]) => k === decToUd(variables.postId)
        )?.[1];

        if (prevPost === null || prevPost === undefined) {
          return prev;
        }

        const newReacts = {
          ...prevPost.seal.reacts,
        };

        delete newReacts[window.our];

        const updatedPost = {
          ...prevPost,
          seal: {
            ...prevPost.seal,
            reacts: newReacts,
          },
        };

        const pageInCache = prev.pages.find((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.postId))
        );

        const pageInCacheIdx = prev.pages.findIndex((page) =>
          Object.keys(page.posts).some((k) => k === decToUd(variables.postId))
        );

        if (pageInCache === undefined) {
          return prev;
        }

        return {
          ...prev,
          pages: [
            ...prev.pages.slice(0, pageInCacheIdx),
            {
              ...pageInCache,
              posts: {
                ...pageInCache?.posts,
                [decToUd(variables.postId)]: updatedPost,
              },
            },
            ...prev.pages.slice(pageInCacheIdx + 1),
          ],
        };
      };

      const postUpdater = (prev: PostDataResponse | undefined) => {
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

      await updatePostInCache(variables, postUpdater);
      await updatePostsInCache(variables, postsUpdater);
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
      const updater = (prev: PostDataResponse | undefined) => {
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
      const updater = (prev: PostDataResponse | undefined) => {
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
  const SINGLE_PAGE_SEARCH_DEPTH = 500;
  const encodedQuery = stringToTa(query);
  const { data, ...rest } = useInfiniteQuery({
    queryKey: ['channel', 'search', nest, query],
    enabled: query !== '',
    queryFn: async ({ pageParam = null }) => {
      const res = await api.scry<ChannelScam>({
        app: 'channels',
        path: `/${nest}/search/bounded/text/${
          pageParam ? decToUd(pageParam.toString()) : ''
        }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
      });
      return res;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.last === null) return undefined;
      return lastPage.last;
    },
  });

  const scan = useMemo(
    () =>
      newChatMap(
        (data?.pages || [])
          .reduce(
            (a: ChannelScan, b: ChannelScam): ChannelScan => a.concat(b.scan),
            []
          )
          .map((scItem: ChannelScanItem) =>
            'post' in scItem
              ? ([bigInt(scItem.post.seal.id), scItem.post] as PostTuple)
              : ([
                  bigInt(scItem.reply.reply.seal.id),
                  scItem.reply.reply,
                ] as ReplyTuple)
          ),
        true
      ),
    [data]
  );

  const depth = useMemo(
    () => (data?.pages.length ?? 0) * SINGLE_PAGE_SEARCH_DEPTH,
    [data]
  );
  const oldestMessageSearched = useMemo(() => {
    const params = data?.pages ?? [];
    const lastValidParam = _.findLast(
      params,
      (page) => page.last !== null
    )?.last;
    return lastValidParam ? new Date(daToUnix(bigInt(lastValidParam))) : null;
  }, [data]);

  return {
    scan,
    depth,
    oldestMessageSearched,
    ...rest,
  };
}

export function useHiddenPosts() {
  return useReactQueryScry<HiddenPosts>({
    queryKey: ['channels', 'hidden'],
    app: 'channels',
    path: '/hidden-posts',
    options: {
      placeholderData: [],
    },
  });
}

export function useTogglePostMutation() {
  const mutationFn = (variables: { toggle: TogglePost }) =>
    api.poke({
      app: 'channels',
      mark: 'channel-action',
      json: {
        'toggle-post': variables.toggle,
      },
    });

  return useMutation(mutationFn, {
    onMutate: ({ toggle }) => {
      const hiding = 'hide' in toggle;
      queryClient.setQueryData<HiddenPosts>(['channels', 'hidden'], (prev) => {
        if (!prev) {
          return hiding ? [udToDec(toggle.hide)] : [];
        }

        return hiding
          ? [...prev, udToDec(toggle.hide)]
          : prev.filter((postId) => postId !== udToDec(toggle.show));
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['channels', 'hidden']);
    },
  });
}

export function usePostToggler(postId: string) {
  const udId = decToUd(postId);
  const { mutate } = useTogglePostMutation();
  const { data: hidden } = useHiddenPosts();
  const isHidden = useMemo(
    () => (hidden || []).some((h) => h === postId),
    [hidden, postId]
  );
  const show = useCallback(
    () => mutate({ toggle: { show: udId } }),
    [mutate, udId]
  );
  const hide = useCallback(
    () => mutate({ toggle: { hide: udId } }),
    [mutate, udId]
  );

  return {
    show,
    hide,
    isHidden,
  };
}

export function useMyLastMessage(
  whom: string,
  postId?: string
): Post | Writ | Reply | null {
  const isDmOrMultiDm = useIsDmOrMultiDm(whom);
  let nest = '';

  if (whom === '') {
    return null;
  }

  if (!isDmOrMultiDm) {
    nest = `chat/${whom}`;
  }

  const lastMessage = (pages: PagedPosts[] | PagedWrits[]) => {
    if (!pages || pages.length === 0) {
      return null;
    }

    if ('writs' in pages[0]) {
      // @ts-expect-error we already have a type guard
      const writs = newWritTupleArray({ pages });
      const myWrits = writs.filter(
        ([_id, msg]) => msg?.essay.author === window.our
      );
      const lastWrit = last(myWrits);
      if (!lastWrit) {
        return null;
      }

      return lastWrit[1];
    }

    if ('posts' in pages[0]) {
      // @ts-expect-error we already have a type guard
      const posts = newPostTupleArray({ pages });
      const myPosts = posts.filter(
        ([_id, msg]) => msg?.essay.author === window.our
      );
      const lastPost = last(myPosts);
      if (!lastPost) {
        return null;
      }

      return lastPost[1];
    }
    return null;
  };

  const lastReply = (replies: Replies) => {
    const myReplies = Object.entries(replies).filter(
      ([_id, msg]) => msg?.memo.author === window.our
    );

    const lastReplyMessage = last(myReplies);
    if (!lastReplyMessage) {
      return null;
    }

    return lastReplyMessage[1];
  };

  if (!isDmOrMultiDm) {
    if (postId) {
      const data = queryClient.getQueryData<PostDataResponse>(
        postKey(nest, postId)
      );
      if (data && 'seal' in data) {
        const { seal } = data;
        return lastReply(seal.replies);
      }
    }

    const data = queryClient.getQueryData<{ pages: PagedPosts[] }>(
      infinitePostsKey(nest)
    );
    if (data) {
      const { pages } = data;
      return lastMessage(pages);
    }

    return null;
  }

  const data = queryClient.getQueryData<{ pages: PagedWrits[] }>(
    ChatQueryKeys.infiniteDmsKey(whom)
  );

  if (data) {
    const { pages } = data;

    return lastMessage(pages);
  }

  return null;
}

export function useIsEdited(message: Post | Writ | Reply) {
  const isEdited = useMemo(
    () => 'revision' in message && message.revision !== '0',
    [message]
  );

  return isEdited;
}
