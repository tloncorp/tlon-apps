import * as db from '../../db';

export const queryKeyPrefix = ['channelPosts'];

export function getLatestChannelPostsQueryData<T>(
  queryKey: readonly unknown[]
): T | undefined {
  let latestMountTime = -1;
  let latestData: T | undefined;

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
      latestData = query.state.data as T;
    }
  }

  return latestData;
}

export const clearChannelPostsQueries = () => {
  db.queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
};
