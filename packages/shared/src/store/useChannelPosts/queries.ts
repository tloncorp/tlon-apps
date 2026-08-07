import type { InfiniteData } from '@tanstack/react-query';

import * as db from '../../db';

export const queryKeyPrefix = ['channelPosts'];

export function getLatestChannelPostsInitialPage<
  TPage,
  TPageParam extends { mode?: unknown; cursorPostId?: unknown },
>(
  queryKey: readonly unknown[],
  initialPageParam: TPageParam
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

  if (!latestData) {
    return undefined;
  }

  const initialPageIndex = latestData.pageParams.findIndex(
    (pageParam) =>
      pageParam.mode === initialPageParam.mode &&
      pageParam.cursorPostId === initialPageParam.cursorPostId
  );
  if (initialPageIndex === -1) {
    return undefined;
  }

  return {
    ...latestData,
    pages: latestData.pages.slice(initialPageIndex, initialPageIndex + 1),
    pageParams: latestData.pageParams.slice(
      initialPageIndex,
      initialPageIndex + 1
    ),
  };
}

export const clearChannelPostsQueries = () => {
  db.queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
};
