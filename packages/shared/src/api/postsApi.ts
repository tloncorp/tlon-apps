import { decToUd } from '@urbit/api';
import _ from 'lodash';

import * as db from '../db';
import type * as ub from '../urbit/channel';
import { scry, subscribe } from './urbit';

export const STANDARD_MESSAGE_FETCH_PAGE_SIZE = 100;

// TODO: Switch page size based on whether we're on mobile or desktop?
const POST_PAGE_SIZE = STANDARD_MESSAGE_FETCH_PAGE_SIZE;

export const getPostsForChannel = async ({
  nest,
  pageSize = POST_PAGE_SIZE,
  initialTime,
  olderThanTime,
  newerThanTime,
}: {
  nest: ub.Nest;
  pageSize?: number;
  initialTime?: string;
  olderThanTime?: string;
  newerThanTime?: string;
}) => {
  let path = '';

  if (olderThanTime) {
    const ud = decToUd(olderThanTime);
    path = `/v1/${nest}/posts/older/${ud}/${pageSize}/outline`;
  } else if (newerThanTime) {
    const ud = decToUd(newerThanTime);
    path = `/v1/${nest}/posts/newer/${ud}/${pageSize}/outline`;
  } else if (initialTime) {
    path = `/v1/${nest}/posts/around/${decToUd(initialTime)}/${
      pageSize / 2
    }/outline`;
  } else {
    path = `/v1/${nest}/posts/newest/${pageSize}/outline`;
  }

  const response = await scry<ub.PagedPosts>({
    app: 'channels',
    path,
  });

  return toClientPosts(response.posts, nest);
};

// export const subscribePostsForChannel = (
// nest: ub.Nest,
// handler: (posts: db.PostInsert[]) => Promise<void>
// ) => {
// subscribe<ub.PostResponse>(
// { app: 'channels', path: `/v1/${nest}/posts` },
// async (update) => {
// const posts = toClientPosts(update.posts, nest);
// handler(posts);
// }
// );
// };

export const toClientPosts = (
  posts: ub.Posts,
  nest: ub.Nest
): db.PostInsert[] => {
  return Object.entries(posts).flatMap(([time, post]) =>
    post === null ? [] : [toClientPost(time, post, nest)]
  );
};

export const toClientPost = (
  time: string,
  post: ub.Post,
  nest: ub.Nest
): db.PostInsert => {
  const getTitle = (post: ub.Post) => {
    return 'diary' in post.essay['kind-data']
      ? post.essay['kind-data'].diary.title
      : 'heap' in post.essay['kind-data']
        ? post.essay['kind-data'].heap
        : '';
  };

  const getImage = (post: ub.Post) => {
    return 'diary' in post.essay['kind-data']
      ? post.essay['kind-data'].diary.image
      : '';
  };

  const getType = (post: ub.Post) => {
    return 'diary' in post.essay['kind-data']
      ? 'diary'
      : 'heap' in post.essay['kind-data']
        ? 'heap'
        : 'chat';
  };

  return {
    id: time,
    authorId: post.essay.author,
    channelId: nest,
    title: getTitle(post),
    image: getImage(post),
    content: JSON.stringify(post.essay.content),
    sentAt: post.essay.sent,
    replyCount: post.seal.meta.replyCount,
    type: getType(post),
  };
};
