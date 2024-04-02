import { beforeAll, beforeEach, expect, test } from 'vitest';

import { PostInsert } from '../db';
import rawChannelPostsData from '../test/channelPosts.json';
import { resetDb, setupDb } from '../test/helpers';
import { PagedPosts } from '../urbit';
import { toPostsData } from './postsApi';

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

test('toPostData', async () => {
  const postsData = rawChannelPostsData as unknown as PagedPosts;
  const result = toPostsData('testChannielId', postsData.posts);
  const oldestPost = result.reduce<PostInsert>((acc, post) => {
    const time = post.receivedAt ?? 0;
    return time < (acc.receivedAt ?? 0) ? post : acc;
  }, result[0]);
  expect(oldestPost.id).toEqual(result[0].id);
});
