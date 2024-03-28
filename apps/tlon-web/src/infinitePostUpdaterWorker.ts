/// <reference lib="webworker" />

/* eslint-disable no-restricted-globals */

/* eslint-disable no-case-declarations */
import {
  ChannelsResponse,
  PagedPosts,
  PostDataResponse,
  Reply,
} from '@tloncorp/shared/dist/urbit/channel';
import { decToUd, udToDec, unixToDa } from '@urbit/api';
import _ from 'lodash';

// defined here to avoid circular dependency
type PageParam = null | {
  time: string;
  direction: string;
};

interface PostsInCachePrev {
  pages: PagedPosts[];
  pageParams: PageParam[];
}

self.addEventListener('message', (event) => {
  console.log(
    'infinitePostUpdaterWorker.ts: message event received.',
    event.data
  );
  try {
    const { prev, data, queryKey, type } = event.data;

    switch (type) {
      case 'reply':
        const replyUpdates = replyUpdater(prev, data);
        const lastReply = Object.values(replyUpdates?.seal.replies ?? {}).pop();
        const replyStatusData = {
          author: lastReply?.memo.author,
          sent: lastReply?.memo.sent,
        };

        self.postMessage({
          queryKey,
          updates: replyUpdates,
          statusData: replyStatusData,
        });
        console.log('infinitePostUpdaterWorker.ts: replyUpdates:', {
          replyUpdates,
          statusData: replyStatusData,
        });
        break;
      case 'post':
        const infiniteUpdates = infinitePostUpdater(prev, data);
        const lastPost = Object.values(
          infiniteUpdates?.pages[0].posts ?? {}
        ).pop();
        const postStatusData = {
          author: lastPost?.essay.author,
          sent: lastPost?.essay.sent,
        };

        self.postMessage({
          queryKey,
          updates: infiniteUpdates,
          statusData: postStatusData,
        });
        console.log(
          'infinitePostUpdaterWorker.ts: infiniteUpdates:',
          infiniteUpdates
        );
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('Error processing events', e);
    self.postMessage({ error: e });
  }
  // const updates = infinitePostUpdater(prev, data);
  // self.postMessage({ queryKey, updates });
});

function replyUpdater(
  prev: PostDataResponse | undefined,
  data: ChannelsResponse
): PostDataResponse | undefined {
  const { nest, response } = data;

  console.log({ response });

  if (!('post' in response)) {
    return prev;
  }

  const postResponse = response.post['r-post'];
  const { id } = response.post;
  const time = decToUd(id);

  console.log({ postResponse });

  if (!('reply' in postResponse)) {
    return prev;
  }

  const {
    reply: {
      meta: { replyCount, lastReply, lastRepliers },
      'r-reply': reply,
    },
  } = postResponse;

  // const [han, flag] = nestToFlag(nest);

  // const replyQueryKey = [han, 'posts', flag, udToDec(time.toString())];
  if (reply && !('set' in reply)) {
    return prev;
  }

  if (reply.set === null) {
    if (prev === undefined) {
      return undefined;
    }

    const existingReplies = prev.seal.replies ?? {};

    const newReplies = Object.keys(existingReplies)
      .filter((k) => k !== reply.set?.seal.id)
      .reduce(
        (acc, k) => {
          // eslint-disable-next-line no-param-reassign
          acc[k] = existingReplies[k];
          return acc;
        },
        {} as { [key: string]: Reply }
      );

    const newPost = {
      ...prev,
      seal: {
        ...prev.seal,
        replies: newReplies,
        meta: {
          ...prev.seal.meta,
          replyCount,
          lastReply,
          lastRepliers,
        },
      },
    };

    return newPost;
  }

  if ('memo' in reply.set) {
    const newReply = reply.set;
    if (prev === undefined) {
      return undefined;
    }

    const existingReplies = prev.seal.replies ?? {};

    const existingCachedReply =
      existingReplies[decToUd(unixToDa(newReply.memo.sent).toString())];

    if (existingCachedReply) {
      // remove cached reply if it exists
      delete existingReplies[decToUd(unixToDa(newReply.memo.sent).toString())];
    }

    const newReplies = {
      ...existingReplies,
      [decToUd(newReply.seal.id)]: newReply,
    };

    const newPost = {
      ...prev,
      seal: {
        ...prev.seal,
        replies: newReplies,
        meta: {
          ...prev.seal.meta,
          replyCount,
          lastReply,
          lastRepliers,
        },
      },
    };

    // usePostsStore.getState().updateStatus(
    // {
    // author: newReply.memo.author,
    // sent: newReply.memo.sent,
    // },
    // 'delivered'
    // );

    return newPost;
  }

  return prev;
}

function infinitePostUpdater(
  prev: PostsInCachePrev | undefined,
  data: ChannelsResponse
): PostsInCachePrev | undefined {
  const { nest, response } = data;

  console.log({ response });

  if (!('post' in response)) {
    return prev;
  }

  const postResponse = response.post['r-post'];
  const { id } = response.post;
  const time = decToUd(id);

  console.log({ postResponse });

  if ('set' in postResponse) {
    const post = postResponse.set;

    if (post === null) {
      if (prev === undefined) {
        return prev;
      }

      const newPages = prev.pages.map((page) => {
        const newPage = {
          ...page,
        };

        const inPage =
          Object.keys(newPage.posts).some((k) => k === time) ?? false;

        if (inPage) {
          const pagePosts = { ...newPage.posts };

          pagePosts[time] = null;

          newPage.posts = pagePosts;
        }

        return newPage;
      });

      return {
        pages: newPages,
        pageParams: prev.pageParams,
      };
    }
    if (prev === undefined) {
      return {
        pages: [
          {
            posts: {
              [time]: post,
            },
            newer: null,
            older: null,
            total: 1,
          },
        ],
        pageParams: [],
      };
    }

    const firstPage = _.first(prev.pages);

    if (firstPage === undefined) {
      return undefined;
    }

    const newPosts = {
      ...firstPage.posts,
      [time]: post,
    };

    const newFirstpage: PagedPosts = {
      ...firstPage,
      posts: newPosts,
      total: firstPage.total + 1,
    };

    const cachedPost =
      firstPage.posts[decToUd(unixToDa(post.essay.sent).toString())];

    if (cachedPost && id !== udToDec(unixToDa(post.essay.sent).toString())) {
      // remove cached post if it exists
      delete newFirstpage.posts[decToUd(unixToDa(post.essay.sent).toString())];

      // set delivered now that we have the real post
      // usePostsStore
      // .getState()
      // .updateStatus(
      // { author: post.essay.author, sent: post.essay.sent },
      // 'delivered'
      // );
    }

    return {
      pages: [newFirstpage, ...prev.pages.slice(1, prev.pages.length)],
      pageParams: prev.pageParams,
    };
  }

  if ('reacts' in postResponse) {
    if (prev === undefined) {
      return undefined;
    }

    const { reacts } = postResponse;

    const newPages = prev.pages.map((page) => {
      const newPage = {
        ...page,
      };

      const inPage =
        Object.keys(newPage.posts).some((k) => k === time) ?? false;

      if (inPage) {
        const post = newPage.posts[time];
        if (!post) {
          return newPage;
        }
        newPage.posts[time] = {
          ...post,
          seal: {
            ...post.seal,
            reacts,
          },
        };

        return newPage;
      }

      return newPage;
    });

    return {
      pages: newPages,
      pageParams: prev.pageParams,
    };
  }

  if ('essay' in postResponse) {
    if (prev === undefined) {
      return undefined;
    }

    const { essay } = postResponse;

    const newPages = prev.pages.map((page) => {
      const newPage = {
        ...page,
      };

      const inPage =
        Object.keys(newPage.posts).some((k) => k === time) ?? false;

      if (inPage) {
        const post = newPage.posts[time];
        if (!post) {
          return page;
        }
        newPage.posts[time] = {
          ...post,
          essay,
        };

        return newPage;
      }

      return newPage;
    });

    return {
      pages: newPages,
      pageParams: prev.pageParams,
    };
  }

  return prev;
}
