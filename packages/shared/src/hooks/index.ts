import {
  UseQueryResult,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import { WrappedQuery } from '../db/query';
import { createDevLogger } from '../debug';
import * as sync from '../sync';

export * from './useChannelSearch';

const logger = createDevLogger('hooks', false);

const postsLogger = createDevLogger('useChannelPosts', true);

export const useChannelPosts = (options: db.GetChannelPostsOptions) => {
  useEffect(() => {
    postsLogger.log('mount', options);
    return () => {
      postsLogger.log('unmount', options);
    };
  }, []);
  const initialPageParam = useMemo(() => ({ ...options }), []);
  return useInfiniteQuery({
    // TODO: why doesn't initialPageParam work?
    initialPageParam,
    queryFn: async (ctx): Promise<db.PostWithRelations[]> => {
      const queryOptions = ctx.pageParam || options;
      postsLogger.log(
        'start',
        queryOptions.channelId,
        queryOptions.cursor,
        queryOptions.direction,
        queryOptions.date,
        queryOptions.count
      );
      const cached = await db.getChannelPosts(queryOptions);
      if (cached?.length) {
        postsLogger.log('returning', cached.length, 'posts from db');
        return cached;
      }
      postsLogger.log('no posts found in database, loading from api...');
      const res = await sync.syncPosts(queryOptions);
      postsLogger.log('loaded', res.posts?.length, 'posts from api');
      const secondResult = await db.getChannelPosts(queryOptions);
      postsLogger.log(
        'returning',
        secondResult?.length,
        'posts from db after syncing from api'
      );
      return secondResult ?? [];
    },
    queryKey: [
      ['channel', initialPageParam.channelId],
      useKeyFromQueryDeps(db.getChannelPosts),
      [
        initialPageParam.cursor,
        initialPageParam.date,
        initialPageParam.direction,
        initialPageParam.count,
      ],
    ],
    getNextPageParam: (lastPage): db.GetChannelPostsOptions | undefined => {
      if (!lastPage[lastPage.length - 1]?.id) return undefined;
      return {
        ...options,
        direction: 'older',
        cursor: lastPage[lastPage.length - 1]?.id,
        date: undefined,
      };
    },
    getPreviousPageParam: (
      firstPage
    ): db.GetChannelPostsOptions | undefined => {
      if (!firstPage[0]?.id) return undefined;
      return {
        ...options,
        direction: 'newer',
        cursor: firstPage[0]?.id,
        date: undefined,
      };
    },
  });
};

export interface CurrentChats {
  pinned: db.ChannelSummary[];
  unpinned: db.ChannelSummary[];
}

export interface TableDependecies {
  groups: boolean;
  pins: boolean;
  contacts: boolean;
  channels: boolean;
  unreads: boolean;
  posts: boolean;
}

export const useCurrentChats = (): UseQueryResult<CurrentChats | null> => {
  return useQuery({
    queryFn: db.getChats,
    queryKey: ['currentChats', useKeyFromQueryDeps(db.getGroup)],
    select(channels: db.ChannelSummary[]) {
      for (let i = 0; i < channels.length; ++i) {
        if (!channels[i].pin) {
          return {
            pinned: channels.slice(0, i),
            unpinned: channels.slice(i),
          };
        }
      }
      return {
        pinned: channels,
        unpinned: [],
      };
    },
  });
};

export const useContact = (options: { id: string }) => {
  return useQuery({
    queryKey: [['contact', options]],
    queryFn: () => db.getContact(options),
  });
};

export const useContacts = () => {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: db.getContacts,
  });
};

export const useAllUnreadsCounts = () => {
  return useQuery({
    queryKey: ['allUnreadsCounts'],
    queryFn: db.getAllUnreadsCounts,
  });
};

export const useUnreads = (options: db.GetUnreadsOptions) => {
  return useQuery({
    queryKey: ['unreads'],
    queryFn: () => db.getUnreads(options),
  });
};

export const useGroups = (options: db.GetGroupsOptions) => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => db.getGroups(options).then((r) => r ?? null),
  });
};

export const useGroup = (options: { id: string }) => {
  return useQuery({
    queryKey: [['group', options], useKeyFromQueryDeps(db.getGroup, options)],
    queryFn: () =>
      db.getGroup(options).then((r) => {
        return r ?? null;
      }),
  });
};

export const useGroupByChannel = (channelId: string) => {
  return useQuery({
    queryKey: [['group', channelId]],
    queryFn: () => db.getGroupByChannel(channelId).then((r) => r ?? null),
  });
};

export const useChannelPostsAround = (
  options: db.GetChannelPostsAroundOptions
) => {
  return useQuery({
    queryKey: [['channelPostsAround', options]],
    queryFn: () => db.getChannelPostsAround(options),
  });
};

export const useChannelSearchResults = (
  channelId: string,
  postIds: string[]
) => {
  return useQuery({
    queryKey: [['channelSearchResults', channelId, postIds]],
    queryFn: () => db.getChannelSearchResults(channelId, postIds),
  });
};

export const useChannelWithLastPostAndMembers = (
  options: db.GetChannelWithLastPostAndMembersOptions
) => {
  return useQuery({
    queryKey: [['channelWithLastPostAndMembers', options]],
    queryFn: () => db.getChannelWithLastPostAndMembers(options),
  });
};

export const useChannel = (options: { id: string }) => {
  return useQuery({
    queryKey: [['channel', options]],
    queryFn: () => db.getChannel(options),
  });
};

function useKeyFromQueryDeps(query: WrappedQuery<any, any>, options?: any) {
  return useMemo(() => keyFromQueryDeps(query, options), [query, options]);
}

function keyFromQueryDeps(query: WrappedQuery<any, any>, options?: any) {
  return new Set(
    query.meta.tableDependencies instanceof Function
      ? query.meta.tableDependencies(options)
      : query.meta.tableDependencies
  );
}
