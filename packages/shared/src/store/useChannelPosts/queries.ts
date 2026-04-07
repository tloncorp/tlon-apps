import * as db from '../../db';

export const queryKeyPrefix = ['channelPosts'];

export const clearChannelPostsQueries = () => {
  db.queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
};
