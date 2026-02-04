import { da, render } from '@urbit/aura';
import { Poke } from '@urbit/http-api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { ContentReference } from '../domain';
import {
  IMAGE_URL_REGEX,
  PlaintextPreviewConfig,
  getTextContent,
} from '../logic';
import * as ub from '../urbit';
import {
  ClubAction,
  DmAction,
  HiddenMessages,
  HiddenPosts,
  KindData,
  KindDataChat,
  ReplyDelta,
  Story,
  WritDelta,
  WritDeltaAdd,
  WritDeltaAddReact,
  WritDeltaDelReact,
  WritDiff,
  checkNest,
  getChannelType,
  whomIsDm,
} from '../urbit';
import {
  formatDateParam,
  formatScryPath,
  formatUd,
  getCanonicalPostId,
  getChannelIdType,
  isDmChannelId,
  isGroupChannelId,
  isGroupDmChannelId,
  toPostEssay,
  udToDate,
  with404Handler,
} from './apiUtils';
import { channelAction } from './channelsApi';
import { multiDmAction } from './chatApi';
import { poke, scry, subscribeOnce } from './urbit';

const logger = createDevLogger('postsApi', false);

export type Cursor = string | Date;
export type PostContent = (ub.Verse | ContentReference)[] | null;
export type PostContentAndFlags = [PostContent, db.PostFlags | null];

export function chatAction(
  whom: string,
  id: string,
  delta: WritDelta
): Poke<DmAction | ClubAction> {
  if (whomIsDm(whom)) {
    const action: Poke<DmAction> = {
      app: 'chat',
      mark: 'chat-dm-action-1',
      json: {
        ship: whom,
        diff: {
          id,
          delta,
        },
      },
    };
    return action;
  }

  const diff: WritDiff = { id, delta };
  const action: Poke<ClubAction> = {
    app: 'chat',
    mark: 'chat-club-action-1',
    json: {
      id: whom,
      diff: {
        uid: '0v3',
        delta: { writ: diff },
      },
    },
  };

  return action;
}

export async function getPostReference({
  channelId,
  postId,
  replyId,
}: {
  channelId: string;
  postId: string;
  replyId?: string;
}) {
  const path = `/said/${channelId}/post/${postId}${
    replyId ? '/' + replyId : ''
  }`;
  const data = await subscribeOnce<ub.Said>(
    { app: 'channels', path },
    3000,
    undefined,
    { tag: 'getPostReference' }
  );
  const post = toPostReference(data);
  // The returned post id can be different than the postId we requested?? But the
  // post is going to be requested by the original id, so set manually :/
  post.id = postId;
  return post;
}

function toPostReference(said: ub.Said) {
  const channelId = said.nest;
  if ('reply' in said.reference) {
    return toPostReplyData(
      channelId,
      said.reference.reply['id-post'],
      said.reference.reply.reply
    );
  } else if ('post' in said.reference) {
    return toPostData(channelId, said.reference.post);
  } else {
    throw new Error('invalid response' + JSON.stringify(said, null, 2));
  }
}

function channelPostAction(nest: ub.Nest, action: ub.PostAction) {
  checkNest(nest);

  return channelAction(nest, {
    post: action,
  });
}

export const sendPost = async ({
  channelId,
  authorId,
  sentAt,
  content,
  blob,
  metadata,
}: {
  channelId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  blob?: string;
  metadata?: db.PostMetadata;
}) => {
  logger.log('sending post', { channelId, authorId, sentAt, content });
  const channelType = getChannelType(channelId);

  if (channelType === 'dm' || channelType === 'groupDm') {
    const delta: WritDeltaAdd = {
      add: {
        essay: {
          content,
          sent: sentAt,
          author: authorId,
          kind: '/chat',
          meta: null,
          blob: blob ?? null,
        },
        time: null,
      },
    };

    const action = chatAction(
      channelId,
      `${delta.add.essay.author}/${formatUd(da.fromUnix(delta.add.essay.sent).toString())}`,
      delta
    );
    await poke(action);
    return;
  }

  const essay = toPostEssay({
    content,
    blob,
    authorId,
    sentAt,
    channelType,
    metadata: metadata
      ? {
          title: metadata.title || '',
          image: metadata.image || '',
          description: metadata.description || '',
          cover: metadata.cover || '',
        }
      : undefined,
  });

  const action = channelPostAction(channelId, {
    add: essay,
  });

  await poke(action);
  logger.log('post sent', { channelId, authorId, sentAt, content });
};

export const editPost = async ({
  channelId,
  postId,
  authorId,
  sentAt,
  content,
  parentId,
  metadata,
  blob,
}: {
  channelId: string;
  postId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  parentId?: string;
  metadata?: db.PostMetadata;
  blob?: string;
}) => {
  logger.log('editing post', { channelId, postId, authorId, sentAt, content });
  const channelType = getChannelType(channelId);
  if (isDmChannelId(channelId) || isGroupDmChannelId(channelId)) {
    logger.error('Cannot edit a post in a DM or group DM');
    throw new Error('Cannot edit a post in a DM or group DM');
  }

  if (parentId) {
    logger.log('editing a reply');
    const memo: ub.Memo = {
      author: authorId,
      content,
      sent: sentAt,
    };

    const action: ub.Action = {
      post: {
        reply: {
          id: parentId,
          action: {
            edit: {
              id: postId,
              memo,
            },
          },
        },
      },
    };

    logger.log('sending action', action);
    await poke(channelAction(channelId, action));
    logger.log('action sent');
    return;
  }

  logger.log('editing a post');

  const essay = toPostEssay({
    content,
    authorId,
    sentAt,
    channelType,
    blob,
    metadata: metadata
      ? {
          title: metadata.title || '',
          image: metadata.image || '',
          description: metadata.description || '',
          cover: metadata.cover || '',
        }
      : undefined,
  });

  const action = channelPostAction(channelId, {
    edit: {
      id: postId,
      essay,
    },
  });

  logger.log('sending action', action);
  await poke(action);
  logger.log('action sent');
};

export const sendReply = async ({
  channelId,
  parentId,
  parentAuthor,
  content,
  sentAt,
  authorId,
}: {
  authorId: string;
  channelId: string;
  parentId: string;
  parentAuthor: string;
  content: Story;
  sentAt: number;
}) => {
  if (isDmChannelId(channelId) || isGroupDmChannelId(channelId)) {
    const delta: ub.ReplyDelta = {
      reply: {
        id: `${authorId}/${formatUd(da.fromUnix(sentAt).toString())}`,
        meta: null,
        delta: {
          add: {
            memo: {
              content,
              author: authorId,
              sent: sentAt,
            },
            time: null,
          },
        },
      },
    };

    const action = chatAction(channelId, `${parentAuthor}/${parentId}`, delta);
    await poke(action);
    return;
  }

  const postAction: ub.PostAction = {
    reply: {
      id: parentId,
      action: {
        add: {
          content,
          author: authorId,
          sent: sentAt,
        },
      },
    },
  };

  const action = channelPostAction(channelId, postAction);
  await poke(action);
};
export interface GetSequencedPostsOptions {
  channelId: string;
  start: number;
  end: number;
  includeReplies?: boolean;
}

export const getSequencedChannelPosts = async (
  options: GetSequencedPostsOptions
) => {
  const encodedStart = formatUd(options.start.toString());
  const encodedEnd = formatUd(options.end.toString());

  const type = getChannelIdType(options.channelId);
  const app = type === 'channel' ? 'channels' : 'chat';
  const endpoint = formatScryPath(
    ...[
      type === 'dm' ? 'v3/dm' : null,
      type === 'club' ? 'v3/club' : null,
      type === 'channel' ? 'v4' : null,
    ],
    options.channelId,
    type === 'channel' ? 'posts' : 'writs',
    'range',
    encodedStart,
    encodedEnd,
    ...[
      type === 'channel' ? (options.includeReplies ? 'post' : 'outline') : null,
      type !== 'channel' ? (options.includeReplies ? 'heavy' : 'light') : null,
    ]
  );

  const response = await scry<ub.PagedPosts | ub.PagedWrits>({
    app: app,
    path: endpoint,
  });

  const clientPosts = toPagedPostsData(options.channelId, response).posts;
  const withoutGaps = fillSequenceGaps(clientPosts, {
    lowerBound: options.start,
    upperBound: options.end,
  });

  if (withoutGaps.numStubs > 0) {
    logger.log('filled sequence gaps', {
      channelId: options.channelId,
      start: options.start,
      end: options.end,
      numStubs: withoutGaps.numStubs,
    });
  }

  return {
    posts: withoutGaps.posts,
    newestSequenceNum: Number(response.newest),
  };
};

export type GetChannelPostsOptions = {
  channelId: string;
  count?: number;
  includeReplies?: boolean;
  mode: 'older' | 'newer' | 'around' | 'newest';
  cursor?: Cursor;
  sequenceBoundary?: number | null;
};

export interface GetChannelPostsResponse {
  older?: string | null;
  newer?: string | null;
  posts: db.Post[];
  deletedPosts?: db.Post[];
  totalPosts?: number;
}

export const getInitialPosts = async (config: {
  channelCount: number;
  postCount: number;
}) => {
  const response = await scry<ub.PostsInit>({
    app: 'groups-ui',
    path: `/v5/init-posts/${config.channelCount}/${config.postCount}`,
  });

  const channelPosts = Object.entries(response.channels).flatMap(
    ([channelId, posts]) => (posts ? toPostsData(channelId, posts).posts : [])
  );
  const chatPosts = Object.entries(response.chat).flatMap(([chatId, posts]) =>
    posts ? toPostsData(chatId, posts).posts : []
  );

  return [...channelPosts, ...chatPosts];
};

export const getChannelPosts = async ({
  channelId,
  cursor,
  mode = 'older',
  count = 20,
  includeReplies = false,
  sequenceBoundary = null,
}: GetChannelPostsOptions) => {
  const type = getChannelIdType(channelId);
  const app = type === 'channel' ? 'channels' : 'chat';
  const path = formatScryPath(
    ...[
      type === 'dm' ? 'v3/dm' : null,
      type === 'club' ? 'v3/club' : null,
      type === 'channel' ? 'v4' : null,
    ],
    channelId,
    type === 'channel' ? 'posts' : 'writs',
    mode,
    cursor ? formatCursor(cursor) : null,
    count,
    ...[
      type === 'channel' ? (includeReplies ? 'post' : 'outline') : null,
      type !== 'channel' ? (includeReplies ? 'heavy' : 'light') : null,
    ]
  );

  const response = await with404Handler(
    scry<ub.PagedWrits | ub.PagedPosts>({
      app,
      path,
    }),
    { posts: [] }
  );
  const postsResponse = toPagedPostsData(channelId, response);
  const { posts: finalPosts, numStubs } = fillSequenceGaps(
    postsResponse.posts,
    { upperBound: null, lowerBound: null }
  );

  return {
    ...postsResponse,
    posts: finalPosts,
    numStubs,
    numDeletes: postsResponse.deletedPosts?.length ?? 0,
    newestSequenceNum: response.newest,
  };
};

// we need to account for gaps in sequence numbers to avoid ever locking up
// if there's a contiguity bug on the backends. To accomplish this
// without reintroducing windowing, we insert dummy posts whenever fetching a known
// contiguous block of posts
export function fillSequenceGaps(
  responsePosts: db.Post[],
  config: { upperBound: number | null; lowerBound: number | null }
): { posts: db.Post[]; numStubs: number } {
  // --- Step 1: Handle empty input ---
  if (!responsePosts.length) {
    return { posts: [], numStubs: 0 };
  }

  // --- Step 2: If not provided explicitly, use the data to determine the window ---
  const explicitWindowProvided =
    config.lowerBound !== null && config.upperBound !== null;
  let minSeq = config.lowerBound ?? Infinity;
  let maxSeq = config.upperBound ?? 0;
  let numStubs = 0;

  const existingPostMap = new Map<number, db.Post>();
  for (const post of responsePosts) {
    if (typeof post.sequenceNum !== 'number') {
      // this should never happen
      logger.trackError('post missing sequence number while filling gaps');
      continue;
    }

    if (!explicitWindowProvided) {
      if (post.sequenceNum < minSeq) {
        minSeq = post.sequenceNum;
      }
      if (post.sequenceNum > maxSeq) {
        maxSeq = post.sequenceNum;
      }
    }
    existingPostMap.set(post.sequenceNum, post);
  }

  // --- Step 3: Iterate through the range and fill gaps ---
  const mergedPosts: db.Post[] = [];
  const examplePost = responsePosts[0];
  let previousSentAt = examplePost.sentAt;
  for (let i = minSeq; i <= maxSeq; i++) {
    const existingPost = existingPostMap.get(i);
    if (existingPost) {
      previousSentAt = existingPost.sentAt;
      mergedPosts.push(existingPost);
    } else {
      const nextSentAt = previousSentAt + 1;
      mergedPosts.push(
        toSequenceStubPost({
          channelId: examplePost.channelId,
          type: examplePost.type,
          sentAt: nextSentAt,
          sequenceNum: i,
        })
      );
      previousSentAt = nextSentAt;
      numStubs++;
    }
  }

  return { posts: mergedPosts, numStubs };
}

export type PostWithUpdateTime = {
  channelId: string;
  updatedAt: number;
  latestPost: db.Post;
};

export type GetLatestPostsResponse = PostWithUpdateTime[];

export const getLatestPosts = async ({
  afterCursor,
  count,
}: {
  afterCursor?: Cursor;
  count?: number;
}): Promise<GetLatestPostsResponse> => {
  try {
    const { channels, dms } = await scry<ub.CombinedHeads>({
      app: 'groups-ui',
      path: formatScryPath(
        'v3/heads',
        afterCursor ? formatCursor(afterCursor) : null,
        count
      ),
    });

    return [...channels, ...dms].map((head) => {
      const channelId = 'nest' in head ? head.nest : head.whom;
      const latestPost = toPostData(channelId, head.latest);
      return {
        channelId: channelId,
        updatedAt: head.recency,
        latestPost,
      };
    });
  } catch (e) {
    logger.trackError('failed to sync heads', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return [];
  }
};

export interface GetChangedPostsOptions {
  channelId: string;
  startCursor: Cursor;
  endCursor: Cursor;
  afterTime: Date;
}

export type GetChangedPostsResponse = GetChannelPostsResponse;

export const getChangedPosts = async ({
  channelId,
  startCursor,
  endCursor,
  afterTime,
}: GetChangedPostsOptions): Promise<GetChangedPostsResponse> => {
  if (!isGroupChannelId(channelId)) {
    throw new Error(
      `invalid channel id  ${channelId}:
      server does not implement this endpoint for non-group channels`
    );
  }
  const response = await scry<ub.PagedPosts>({
    app: 'channels',
    path: formatScryPath(
      `v1/${channelId}/posts/changes`,
      formatCursor(startCursor),
      formatCursor(endCursor),
      render('da', da.fromUnix(afterTime.valueOf()))
    ),
  });
  return toPagedPostsData(channelId, response);
};

export async function addReaction({
  channelId,
  postId,
  emoji,
  our,
  postAuthor,
  parentAuthorId,
  parentId,
}: {
  channelId: string;
  postId: string;
  emoji: string;
  our: string;
  postAuthor: string;
  parentAuthorId?: string;
  parentId?: string;
}) {
  // Log if we're sending a shortcode to the server
  if (/^:[a-zA-Z0-9_+-]+:?$/.test(emoji)) {
    logger.trackError('Sending shortcode reaction to server', {
      channelId,
      postId,
      emoji,
      context: 'addReaction_api',
      stack: new Error().stack,
    });
  }

  const isDmOrGroupDm =
    isDmChannelId(channelId) || isGroupDmChannelId(channelId);

  if (isDmOrGroupDm) {
    if (isDmChannelId(channelId)) {
      if (parentId) {
        if (!parentId || !parentAuthorId) {
          logger.trackError('Parent post not found', {
            postId,
            parentId,
            parentAuthorId,
            context: 'addReaction_parentPostNotFound',
          });
          return;
        }
        const fullParentId = `${parentAuthorId}/${parentId}`;

        const delta: ReplyDelta = {
          reply: {
            id: `${postAuthor}/${postId}`,
            meta: null,
            delta: {
              'add-react': {
                author: our,
                react: emoji,
              },
            },
          },
        };
        await poke(chatAction(channelId, fullParentId, delta));
      } else {
        const delta: WritDeltaAddReact = {
          'add-react': {
            react: emoji,
            author: our,
          },
        };
        const action = chatAction(channelId, `${postAuthor}/${postId}`, delta);
        await poke(action);
      }
      return;
    } else {
      // Group DM reactions
      if (parentId) {
        if (!parentId || !parentAuthorId) {
          logger.trackError('Parent post not found', {
            postId,
            parentId,
            parentAuthorId,
            context: 'addReaction_parentPostNotFound',
          });
          return;
        }
        const fullParentId = `${parentAuthorId}/${parentId}`;

        const delta: ReplyDelta = {
          reply: {
            id: `${postAuthor}/${postId}`,
            meta: null,
            delta: {
              'add-react': {
                react: emoji,
                author: our,
              },
            },
          },
        };
        await poke(chatAction(channelId, fullParentId, delta));
      } else {
        const delta: WritDeltaAddReact = {
          'add-react': {
            react: emoji,
            author: our,
          },
        };
        await poke(chatAction(channelId, `${postAuthor}/${postId}`, delta));
      }
      return;
    }
  }

  if (parentId) {
    await poke(
      channelAction(channelId, {
        post: {
          reply: {
            id: parentId,
            action: {
              'add-react': {
                id: postId,
                react: emoji,
                ship: our,
              },
            },
          },
        },
      })
    );
  } else {
    await poke(
      channelAction(channelId, {
        post: {
          'add-react': {
            id: postId,
            react: emoji,
            ship: our,
          },
        },
      })
    );
  }
}

export async function removeReaction({
  channelId,
  postId,
  our,
  postAuthor,
  parentId,
  parentAuthorId,
}: {
  channelId: string;
  postId: string;
  our: string;
  postAuthor: string;
  parentId?: string;
  parentAuthorId?: string;
}) {
  const isDmOrGroupDm =
    isDmChannelId(channelId) || isGroupDmChannelId(channelId);

  if (isDmOrGroupDm) {
    if (isDmChannelId(channelId)) {
      if (parentId) {
        if (!parentId || !parentAuthorId) {
          logger.trackError('Parent post not found', {
            postId,
            parentId,
            parentAuthorId,
            context: 'removeReaction_parentPostNotFound',
          });
          return;
        }
        const fullParentId = `${parentAuthorId}/${parentId}`;

        const delta: ReplyDelta = {
          reply: {
            id: `${postAuthor}/${postId}`,
            meta: null,
            delta: {
              'del-react': our,
            },
          },
        };
        return poke(chatAction(channelId, fullParentId, delta));
      } else {
        const delta: WritDeltaDelReact = {
          'del-react': our,
        };
        return poke(chatAction(channelId, `${postAuthor}/${postId}`, delta));
      }
    } else {
      // Group DM reactions
      if (parentId) {
        if (!parentId || !parentAuthorId) {
          logger.trackError('Parent post not found', {
            postId,
            parentId,
            parentAuthorId,
            context: 'removeReaction_parentPostNotFound',
          });
          return;
        }
        const fullParentId = `${parentAuthorId}/${parentId}`;

        const delta: ReplyDelta = {
          reply: {
            id: `${postAuthor}/${postId}`,
            meta: null,
            delta: {
              'del-react': our,
            },
          },
        };
        return poke(chatAction(channelId, fullParentId, delta));
      } else {
        const delta: WritDeltaDelReact = {
          'del-react': our,
        };
        return poke(chatAction(channelId, `${postAuthor}/${postId}`, delta));
      }
    }
  }

  if (parentId) {
    return await poke(
      channelAction(channelId, {
        post: {
          reply: {
            id: parentId,
            action: {
              'del-react': {
                id: postId,
                ship: our,
              },
            },
          },
        },
      })
    );
  } else {
    return await poke(
      channelAction(channelId, {
        post: {
          'del-react': {
            id: postId,
            ship: our,
          },
        },
      })
    );
  }
}

export async function showPost(post: db.Post) {
  if (isGroupChannelId(post.channelId)) {
    const action = {
      app: 'channels',
      mark: 'channel-action-1',
      json: {
        'toggle-post': {
          show: post.id,
        },
      },
    };

    return poke(action);
  }

  const writId = `${post.authorId}/${post.id}`;

  const action = {
    app: 'chat',
    mark: 'chat-toggle-message',
    json: {
      show: writId,
    },
  };

  return poke(action);
}

export async function hidePost(post: db.Post) {
  if (isGroupChannelId(post.channelId)) {
    const action = {
      app: 'channels',
      mark: 'channel-action-1',
      json: {
        'toggle-post': {
          hide: post.id,
        },
      },
    };

    return poke(action);
  }

  const writId = `${post.authorId}/${post.id}`;
  const action = {
    app: 'chat',
    mark: 'chat-toggle-message',
    json: {
      hide: writId,
    },
  };

  return poke(action);
}

export const toClientHiddenPosts = (hiddenPostIds: string[]) => {
  return hiddenPostIds.map((postId) => getCanonicalPostId(postId));
};

export async function reportPost(
  currentUserId: string,
  groupId: string,
  channelId: string,
  post: db.Post
) {
  await hidePost(post);

  const action = {
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          'flag-content': {
            nest: channelId,
            'post-key': {
              post: post.parentId ? post.parentId : post.id,
              reply: post.parentId ? post.id : null,
            },
            src: currentUserId,
          },
        },
      },
    },
  };

  return await poke(action);
}

export const getHiddenPosts = async () => {
  const hiddenPosts = await scry<HiddenPosts>({
    app: 'channels',
    path: '/hidden-posts',
  });

  return hiddenPosts.map((postId) => getCanonicalPostId(postId));
};

export const getHiddenDMPosts = async () => {
  const hiddenDMPosts = await scry<HiddenMessages>({
    app: 'chat',
    path: '/hidden-messages',
  });

  return hiddenDMPosts.map((postId) => getCanonicalPostId(postId));
};

export async function deletePost(
  channelId: string,
  postId: string,
  authorId: string
) {
  const action = isDmChannelId(channelId)
    ? chatAction(channelId, `${authorId}/${postId}`, {
        del: null,
      })
    : isGroupDmChannelId(channelId)
      ? multiDmAction(channelId, {
          writ: {
            id: `${authorId}/${postId}`,
            delta: {
              del: null,
            },
          },
        })
      : channelAction(channelId, {
          post: {
            del: postId,
          },
        });

  // todo: we need to use a tracked poke here (or settle on a different pattern
  // for expressing request response semantics)
  return await poke(action);
}

export async function deleteReply(params: {
  channelId: string;
  parentId: string;
  parentAuthorId: string;
  postId: string;
  authorId: string;
}) {
  let action = null;

  if (isDmChannelId(params.channelId)) {
    action = chatAction(
      params.channelId,
      `${params.parentAuthorId}/${params.parentId}`,
      {
        reply: {
          id: `${params.authorId}/${params.postId}`,
          meta: null,
          delta: {
            del: null,
          },
        },
      }
    );
  } else if (isGroupDmChannelId(params.channelId)) {
    action = multiDmAction(params.channelId, {
      writ: {
        id: `${params.parentAuthorId}/${params.parentId}`,
        delta: {
          reply: {
            id: `${params.authorId}/${params.postId}`,
            meta: null,
            delta: {
              del: null,
            },
          },
        },
      },
    });
  } else {
    action = channelAction(params.channelId, {
      post: {
        reply: {
          id: params.parentId,
          action: {
            del: params.postId,
          },
        },
      },
    });
  }

  return await poke(action);
}

export const getPostWithReplies = async ({
  postId,
  channelId,
  authorId,
}: {
  postId: string;
  channelId: string;
  authorId: string;
}) => {
  logger.log('fetching post with replies', { postId, channelId, authorId });
  if (
    !authorId &&
    (isDmChannelId(channelId) || isGroupDmChannelId(channelId))
  ) {
    throw new Error(
      'author id is required to fetch posts for a dm or group dm'
    );
  }

  let app: 'chat' | 'channels';
  let path: string;

  if (isDmChannelId(channelId)) {
    app = 'chat';
    path = `/v2/dm/${channelId}/writs/writ/id/${authorId}/${postId}`;
  } else if (isGroupDmChannelId(channelId)) {
    app = 'chat';
    path = `/v2/club/${channelId}/writs/writ/id/${authorId}/${postId}`;
  } else if (isGroupChannelId(channelId)) {
    app = 'channels';
    path = `/v4/${channelId}/posts/post/${postId}`;
  } else {
    throw new Error('invalid channel id');
  }

  const post = await scry<ub.Post>({
    app,
    path,
  });

  const postData = toPostData(channelId, post);
  return postData;
};

export interface DeletedPost {
  id: string;
  channelId: string;
}

export function toPagedPostsData(
  channelId: string,
  data: ub.PagedPosts | ub.PagedWrits
): GetChannelPostsResponse {
  const posts = 'writs' in data ? data.writs : data.posts;
  const postsData = toPostsData(channelId, posts);
  return {
    older: data.older ? formatUd(data.older) : null,
    newer: data.newer ? formatUd(data.newer) : null,
    totalPosts: data.total,
    ...postsData,
  };
}

export function toPostsData(
  channelId: string,
  posts: ub.Posts | ub.Writs | Record<string, ub.Reply>
): { posts: db.Post[]; deletedPosts: db.Post[] } {
  const entries = Object.entries(posts);
  const deletedPosts: db.Post[] = [];
  const otherPosts: db.Post[] = [];

  for (const [, post] of entries) {
    // post will only be null if it was deleted and we're interacting with an
    // outdated version of the backend. we just ignore that here, which means
    // that deleted posts will be converted to stubs and not be displayed, but
    // only temporarily until the backend is updated.
    if (post === null) {
      continue;
    }
    const postData = toPostData(channelId, post);
    if (isPostTombstone(post)) {
      deletedPosts.push(postData);
    }
    otherPosts.push(postData);
  }

  otherPosts.sort((a, b) => (a.receivedAt ?? 0) - (b.receivedAt ?? 0));

  return {
    posts: otherPosts,
    deletedPosts,
  };
}

function getAuthorId(author: ub.Author) {
  if (typeof author === 'string') {
    return author;
  } else {
    return author.ship;
  }
}

export function toPostData(
  channelId: string,
  post: ub.Post | ub.PostTombstone | ub.Writ | ub.PostDataResponse
): db.Post {
  const channelType = channelId.split('/')[0];
  const getPostType = (
    post: ub.Post | ub.PostTombstone | ub.Writ | ub.PostDataResponse
  ) => {
    if (isNotice(post)) {
      return 'notice';
    }

    if (channelType === 'chat') {
      return 'chat';
    } else if (channelType === 'diary') {
      return 'note';
    } else if (channelType === 'heap') {
      return 'block';
    } else {
      return 'chat';
    }
  };
  const type = getPostType(post);

  if (isPostTombstone(post)) {
    return {
      id: getCanonicalPostId(post.id),
      authorId: getAuthorId(post.author),
      channelId,
      type,
      sentAt: getReceivedAtFromId(post.id),
      isDeleted: true,
      deletedAt: post['deleted-at'],
      receivedAt: getReceivedAtFromId(post.id),
      sequenceNum: post.seq ? Number(post.seq) : null,
    };
  }

  const [content, flags] = toPostContent(post?.essay.content);
  const id = getCanonicalPostId(post.seal.id);
  const backendTime =
    post.seal && 'time' in post.seal
      ? getCanonicalPostId(post.seal.time.toString())
      : null;

  const replyData = isPostDataResponse(post)
    ? getReplyData(id, channelId, post)
    : null;

  // This is used for backwards compatibility with older gallery posts from
  // the old web frontend, where a user could just link an image that would be
  // rendered as a an image post in a gallery. This is not a feature that is
  // supported by the current frontend, but we still need to be able to render
  // these posts correctly.
  const galleryImageLink =
    channelType === 'heap' &&
    content &&
    content.length === 1 &&
    'inline' in content[0] &&
    content[0].inline.length === 1 &&
    typeof content[0].inline[0] === 'object' &&
    'link' in content[0].inline[0] &&
    content[0].inline[0].link.href.match(IMAGE_URL_REGEX)
      ? content[0].inline[0].link.href
      : null;

  const galleryImageLinkContent: ub.Verse[] = [
    {
      block: {
        // @ts-expect-error - we don't know image size
        image: {
          src: galleryImageLink ?? '',
          alt: 'heap image',
        },
      },
    },
  ];

  // top level posts will have a sequence number, but replies will not
  let sequenceNum = null;
  if ('seq' in post.seal) {
    sequenceNum = Number(post.seal.seq);
  }

  return {
    id,
    channelId,
    type,
    backendTime,
    sequenceNum,
    // Kind data will override
    title: post.essay.meta?.title ?? '',
    image: post.essay.meta?.image ?? '',
    description: post.essay.meta?.description ?? '',
    cover: post.essay.meta?.cover ?? '',
    authorId: getAuthorId(post.essay.author),
    isEdited: 'revision' in post && post.revision !== '0',
    content: galleryImageLink
      ? JSON.stringify(galleryImageLinkContent)
      : JSON.stringify(content),
    textContent: getTextContent(
      post?.essay.content,
      PlaintextPreviewConfig.inlineConfig
    ),
    sentAt: post.essay.sent,
    receivedAt: getReceivedAtFromId(id),
    replyCount: post?.seal.meta.replyCount,
    replyTime: post?.seal.meta.lastReply,
    replyContactIds: post?.seal.meta.lastRepliers,
    images: getContentImages(id, post.essay?.content),
    reactions: (() => {
      const reacts = post?.seal.reacts ?? {};
      // Check for shortcodes in initial post reactions
      if (Object.keys(reacts).length > 0) {
        const shortcodeReactions = Object.entries(reacts).filter(
          ([, v]) => typeof v === 'string' && /^:[a-zA-Z0-9_+-]+:?$/.test(v)
        );

        if (shortcodeReactions.length > 0) {
          logger.trackError('Shortcode reactions in initial post load', {
            postId: id,
            channelId,
            shortcodeReactions: shortcodeReactions.map(([k, v]) => ({
              user: k,
              value: v,
            })),
            allReacts: reacts,
            context: 'initial_post_load',
          });
        }
      }
      return toReactionsData(reacts, id);
    })(),
    replies: replyData,
    deliveryStatus: null,
    syncedAt: Date.now(),
    blob: post.essay.blob ?? null,
    ...flags,
  };
}

function getReceivedAtFromId(postId: string) {
  return udToDate(postId.split('/').pop() ?? postId);
}

function isPostDataResponse(
  post: ub.Post | ub.Writ | ub.PostDataResponse
): post is ub.PostDataResponse {
  return !!(post.seal.replies && !Array.isArray(post.seal.replies));
}

function isPostTombstone(
  post:
    | ub.Post
    | ub.PostTombstone
    | ub.Writ
    | ub.PostDataResponse
    | ub.WritReply
    | ub.Reply
): post is ub.PostTombstone {
  return 'type' in post && post.type === 'tombstone';
}

function getReplyData(
  postId: string,
  channelId: string,
  post: ub.PostDataResponse
): db.Post[] {
  return Object.entries(post.seal.replies ?? {}).map(([, reply]) =>
    toPostReplyData(channelId, postId, reply)
  );
}
export function toReplyMeta(meta?: ub.ReplyMeta | null): db.ReplyMeta | null {
  if (!meta) {
    return null;
  }
  return {
    replyCount: meta.replyCount,
    replyTime: meta.lastReply,
    replyContactIds: meta.lastRepliers,
  };
}

export function toPostReplyData(
  channelId: string,
  postId: string,
  reply: ub.Reply | ub.WritReply | ub.PostTombstone
): db.Post {
  if (isPostTombstone(reply)) {
    return {
      id: getCanonicalPostId(reply.id),
      parentId: getCanonicalPostId(postId),
      authorId: getAuthorId(reply.author),
      channelId,
      type: 'reply',
      sentAt: getReceivedAtFromId(reply.id),
      isDeleted: true,
      deletedAt: reply['deleted-at'],
      receivedAt: getReceivedAtFromId(reply.id),
      sequenceNum: null,
      syncedAt: Date.now(),
    };
  }

  const [content, flags] = toPostContent(reply.memo.content);
  const id = getCanonicalPostId(reply.seal.id);
  const backendTime =
    reply.seal && 'time' in reply.seal
      ? getCanonicalPostId(reply.seal.time.toString())
      : null;
  return {
    id,
    channelId,
    type: 'reply',
    authorId: getAuthorId(reply.memo.author),
    isEdited: !!reply.revision && reply.revision !== '0',
    parentId: getCanonicalPostId(postId),
    reactions: toReactionsData(reply.seal.reacts, id),
    content: JSON.stringify(content),
    textContent: getTextContent(reply.memo.content),
    sentAt: reply.memo.sent,
    // replies aren't sequenced, seq 0 is never genuine. drizzle has trouble
    // targeting nulls for onConflictDoUpdate so we use a default value instead
    sequenceNum: 0,
    backendTime,
    receivedAt: getReceivedAtFromId(id),
    replyCount: 0,
    images: getContentImages(id, reply.memo.content),
    syncedAt: Date.now(),
    ...flags,
  };
}

export function toSequenceStubPost({
  channelId,
  type,
  sequenceNum,
  sentAt,
}: {
  channelId: string;
  type: db.PostType;
  sequenceNum: number;
  sentAt?: number;
}): db.Post {
  const stubPost: db.Post = {
    id: `sequence-stub-${channelId}-${sequenceNum}`,
    type,
    channelId,
    authorId: '~zod',
    sentAt: sentAt ?? Date.now(),
    receivedAt: sentAt ?? Date.now(),
    content: null,
    hidden: false,
    sequenceNum,
    isSequenceStub: true,
  };
  return stubPost;
}

export function toPostContent(story?: ub.Story): PostContentAndFlags {
  if (!story) {
    return [null, null];
  }
  const flags: db.PostFlags = {
    hasAppReference: false,
    hasChannelReference: false,
    hasGroupReference: false,
    hasLink: false,
    hasImage: false,
  };
  const convertedContent = story.map((verse) => {
    if ('block' in verse && 'cite' in verse.block) {
      const reference = toContentReference(verse.block.cite);
      if (reference) {
        if (reference.referenceType === 'app') {
          flags.hasAppReference = true;
        } else if (reference.referenceType === 'channel') {
          flags.hasChannelReference = true;
        } else if (reference.referenceType === 'group') {
          flags.hasGroupReference = true;
        }
        return reference;
      }
    }
    return verse;
  });
  return [convertedContent, flags];
}

export function toUrbitStory(content: PostContent): Story {
  if (!content) {
    return [];
  }
  return content.map((item) => {
    if ('type' in item) {
      return {
        block: {
          cite: contentReferenceToCite(item),
        },
      };
    }
    return item;
  });
}

export function toContentReference(cite: ub.Cite): ContentReference | null {
  if ('chan' in cite) {
    const channelId = cite.chan.nest;
    // I've seen these forms of reference path:
    // /msg/170141184506828851385935487131294105600
    // /msg/170141184506312077223314290444316180480/170141184506312235291442423303751335936
    // /msg/~sogrum-savluc/170.141.184.505.979.681.243.072.382.329.337.971.474
    const messageIdRegex = /\/([0-9\.]+(?=[$\/]?))/g;
    const [postId, replyId] = Array.from(
      cite.chan.where.matchAll(messageIdRegex)
    ).map((m) => {
      return m[1].replace(/\./g, '');
    });
    if (!postId) {
      console.error('found invalid ref', cite);
      return null;
    }
    return {
      type: 'reference',
      referenceType: 'channel',
      channelId,
      postId: formatUd(postId),
      replyId: replyId ? formatUd(replyId) : undefined,
    };
  } else if ('group' in cite) {
    return { type: 'reference', referenceType: 'group', groupId: cite.group };
  } else if ('desk' in cite) {
    const parts = cite.desk.flag.split('/');
    const userId = parts[0];
    const appId = parts[1];
    if (!userId || !appId) {
      console.error('found invalid ref', cite);
      return null;
    }
    return { type: 'reference', referenceType: 'app', userId, appId };
  }
  return null;
}

export function contentReferenceToCite(reference: ContentReference): ub.Cite {
  if (reference.referenceType === 'channel') {
    return {
      chan: {
        nest: reference.channelId,
        where: `/msg/${reference.postId}${
          reference.replyId ? '/' + reference.replyId : ''
        }`,
      },
    };
  } else if (reference.referenceType === 'group') {
    return {
      group: reference.groupId,
    };
  } else if (reference.referenceType === 'app') {
    return {
      desk: {
        flag: `${reference.userId}/${reference.appId}`,
        where: '',
      },
    };
  }
  throw new Error('invalid reference');
}

function parseKindData(kindData?: ub.KindData): db.PostMetadata | undefined {
  if (!kindData) {
    return;
  }
  if ('diary' in kindData) {
    return kindData.diary;
  } else if ('heap' in kindData) {
    return {
      title: kindData.heap,
    };
  }
}

function isNotice(
  post: ub.Post | ub.PostTombstone | ub.Writ | ub.PostDataResponse | null
) {
  if (!post || isPostTombstone(post)) {
    return false;
  }

  return post?.essay.kind === '/chat/notice';
}

function isChatData(data: KindData): data is KindDataChat {
  return 'chat' in (data ?? {});
}

export function getContentImages(postId: string, content?: ub.Story | null) {
  return (content || []).reduce<db.PostImage[]>((memo, story) => {
    if (ub.isBlockVerse(story) && ub.isImage(story.block)) {
      memo.push({ ...story.block.image, postId });
    }
    return memo;
  }, []);
}

export function toReactionsData(
  reacts: Record<string, ub.React>,
  postId: string
): db.Reaction[] {
  return Object.entries(reacts)
    .filter(([, r]) => {
      const isString = typeof r === 'string';
      if (!isString) {
        logger.log('toReactionsData: filtering out non-string reaction', {
          postId,
          reaction: r,
          type: typeof r,
        });
      }
      return isString;
    })
    .map(([name, reaction]) => {
      // Detect and log shortcode patterns
      if (
        typeof reaction === 'string' &&
        /^:[a-zA-Z0-9_+-]+:?$/.test(reaction)
      ) {
        logger.trackError('Shortcode reaction detected in toReactionsData', {
          postId,
          contactId: name,
          reaction,
          context: 'channel_reactions',
          stack: new Error().stack, // To trace where this is called from
        });
      }

      return {
        contactId: name,
        postId,
        value: reaction as string,
      };
    });
}

function formatCursor(cursor: Cursor) {
  if (typeof cursor === 'string') {
    return cursor;
  } else {
    return formatDateParam(cursor);
  }
}
