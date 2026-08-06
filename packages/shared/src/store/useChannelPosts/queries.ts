import type { InfiniteData } from '@tanstack/react-query';

import * as db from '../../db';

export const queryKeyPrefix = ['channelPosts'];

export function getLatestChannelPostsFirstPage<TPage, TPageParam = unknown>(
  queryKey: readonly unknown[]
): InfiniteData<TPage, TPageParam> | undefined {
  let latestMountTime = -1;
  let latestData: InfiniteData<TPage, TPageParam> | undefined;

  for (const query of db.queryClient
    .getQueryCache()
    .findAll({ queryKey, exact: false })) {
    if (query.queryKey.length !== queryKey.length + 1) {
      continue;
    }

    const mountTime = query.queryKey.at(-1);
    if (
      typeof mountTime === 'number' &&
      mountTime > latestMountTime &&
      query.state.data !== undefined
    ) {
      latestMountTime = mountTime;
      latestData = query.state.data as InfiniteData<TPage, TPageParam>;
    }
  }

  return latestData
    ? {
        ...latestData,
        pages: latestData.pages.slice(0, 1),
        pageParams: latestData.pageParams.slice(0, 1),
      }
    : undefined;
}

export const clearChannelPostsQueries = () => {
  db.queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
};
