import { beforeAll, beforeEach, expect, test } from 'vitest';

import { Post } from '../db';
import rawChannelPostWithRepliesData from '../test/channelPostWithReplies.json';
import rawChannelPostsData from '../test/channelPosts.json';
import rawDmPostWithRepliesData from '../test/dmPostWithReplies.json';
import rawGroupDmPostWithRepliesData from '../test/groupDmPostWithReplies.json';
import { resetDb, setupDb } from '../test/helpers';
import { PagedPosts, Posts } from '../urbit';
import { toPostsData } from './postsApi';

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

test('toPostData', async () => {
  const postsData = rawChannelPostsData as unknown as PagedPosts;
  const { posts } = toPostsData('testChannielId', postsData.posts);
  const oldestPost = posts.reduce<Post>((acc, post) => {
    const time = post.receivedAt ?? 0;
    return time < (acc.receivedAt ?? 0) ? post : acc;
  }, posts[0]);
  expect(oldestPost.id).toEqual(posts.find((p) => p.id === oldestPost.id)?.id);
});

test('single post responses', async () => {
  const postsData = {
    '170141184506755078862103651047679459328': rawChannelPostWithRepliesData,
    '170.141.184.506.175.378.579.920.170.967.817.980.477':
      rawDmPostWithRepliesData,
    '170.141.184.506.522.404.989.134.482.281.343.708.299':
      rawGroupDmPostWithRepliesData,
  };
  const result = toPostsData('testChannelId', postsData as unknown as Posts);
  expect(result).toMatchSnapshot();
});
