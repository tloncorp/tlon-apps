import { useInfiniteQuery } from '@tanstack/react-query';
import { decToUd } from '@urbit/api';
import { useMemo } from 'react';

import * as db from '../db';
import { stringToTa } from '../logic/utils';
import { persistScanPosts } from '../sync';
import type * as ub from '../urbit';
import { toPostData } from './postsApi';
import { scry } from './urbit';

export const getUnreadChannels = async () => {
  const response = await scry<ub.Unreads>({
    app: 'channels',
    path: '/unreads',
  });
  return toUnreadsData(response);
};

const searchChatChannel = async (params: {
  channelId: string;
  query: string;
  cursor?: string;
}) => {
  const SINGLE_PAGE_SEARCH_DEPTH = 500;
  const encodedQuery = stringToTa(params.query);

  const response = await scry<ub.ChannelScam>({
    app: 'channels',
    path: `/${params.channelId}/search/bounded/text/${
      params.cursor ? decToUd(params.cursor.toString()) : ''
    }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
  });

  const posts = response.scan
    .filter((scanItem) => 'post' in scanItem && scanItem.post !== undefined)
    .map((scanItem) => (scanItem as { post: ub.Post }).post)
    .map((post) => toPostData(post.seal.id, params.channelId, post));
  const cursor = response.last;

  await persistScanPosts(params.channelId, posts);

  return { posts, cursor };

  // return response;
};

export function useInfiniteChannelSearch(channelId: string, query: string) {
  const { data, ...rest } = useInfiniteQuery({
    queryKey: ['channel', channelId, 'search', query],
    enabled: query !== '',
    queryFn: async ({ pageParam }) => {
      const response = await searchChatChannel({
        channelId,
        query,
        cursor: pageParam,
      });

      return response;
      // const posts = response.scan
      //   .filter((scanItem) => 'post' in scanItem && scanItem.post !== undefined)
      //   .map((scanItem) => (scanItem as { post: ub.Post }).post)
      //   .map((post) => toPostData(post.seal.id, channelId, post));
      // const cursor = response.last;

      // return { posts, cursor };
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      if (lastPage.cursor === null) return undefined;
      return lastPage.cursor;
    },
  });

  const results = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data]
  );

  return {
    ...rest,
    results,
  };
}

type ChannelUnreadData = {
  id: string;
  postCount?: number;
  unreadCount?: number;
  firstUnreadPostId?: string;
  unreadThreads?: db.ThreadUnreadStateInsert[];
  lastPostAt?: number;
};

function toUnreadsData(unreads: ub.Unreads): ChannelUnreadData[] {
  return Object.entries(unreads).map(([id, unread]) => {
    return toUnreadData(id, unread);
  });
}

function toUnreadData(channelId: string, unread: ub.Unread): ChannelUnreadData {
  return {
    id: channelId,
    unreadCount: unread.count,
    firstUnreadPostId: unread.unread?.id ?? undefined,
    unreadThreads: toThreadUnreadStateData(unread),
    lastPostAt: unread.recency,
  };
}

function toThreadUnreadStateData(
  unread: ub.Unread
): db.ThreadUnreadStateInsert[] {
  return Object.entries(unread.threads).map(([threadId, unreadState]) => {
    return {
      threadId,
      count: unreadState.count,
      firstUnreadId: unreadState.id,
    };
  });
}
