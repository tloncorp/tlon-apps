import type { InfiniteData } from '@tanstack/react-query';

import * as db from '../../db';

export const queryKeyPrefix = ['channelPosts'];

export function getLatestChannelPostsInitialPage<
  TPage extends { fetchedAt: number },
  TPageParam extends {
    mode?: unknown;
    cursorPostId?: unknown;
    count?: unknown;
  },
>(
  queryKey: readonly unknown[],
  initialPageParam: TPageParam
): InfiniteData<TPage, TPageParam> | undefined {
  let latestPageFetchedAt = -1;
  let latestData: InfiniteData<TPage, TPageParam> | undefined;
  let latestInitialPageIndex = -1;

  for (const query of db.queryClient
    .getQueryCache()
    .findAll({ queryKey, exact: false })) {
    if (query.queryKey.length !== queryKey.length + 1) {
      continue;
    }

    if (query.state.data === undefined) {
      continue;
    }

    const data = query.state.data as InfiniteData<TPage, TPageParam>;
    const initialPageIndex = data.pageParams.findIndex(
      (pageParam) =>
        pageParam.mode === initialPageParam.mode &&
        pageParam.cursorPostId === initialPageParam.cursorPostId &&
        pageParam.count === initialPageParam.count
    );
    if (
      initialPageIndex !== -1 &&
      data.pages[initialPageIndex].fetchedAt > latestPageFetchedAt
    ) {
      latestPageFetchedAt = data.pages[initialPageIndex].fetchedAt;
      latestData = data;
      latestInitialPageIndex = initialPageIndex;
    }
  }

  if (!latestData) {
    return undefined;
  }

  return {
    ...latestData,
    pages: latestData.pages.slice(
      latestInitialPageIndex,
      latestInitialPageIndex + 1
    ),
    pageParams: latestData.pageParams.slice(
      latestInitialPageIndex,
      latestInitialPageIndex + 1
    ),
  };
}

export const clearChannelPostsQueries = () => {
  db.queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
};
