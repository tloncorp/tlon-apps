import { PagedPosts } from '@/types/channel';

type QueryData = {
  pages: PagedPosts[];
};

type InfinitePostsQueryData = undefined | QueryData;

export default function shouldAddPostToCache(
  queryData: InfinitePostsQueryData
): boolean {
  // if we have no data, don't add to cache since you'd see incomplete message history when
  // navigating to the channel
  if (!queryData) {
    return false;
  }

  // if we have data, but not the newest, we must be viewing a scrollback. We shouldn't add
  // the post to the cache since you'd have a gap between the new messages and the scrollback
  // history until the refetch completes
  const hasNewer = queryData.pages && queryData.pages[0]?.newer;
  if (hasNewer) {
    return false;
  }

  return true;
}
