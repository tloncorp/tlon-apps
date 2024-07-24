import { unixToDa } from '@urbit/api';
import { Poke } from '@urbit/http-api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import {
  ClubAction,
  DmAction,
  HiddenMessages,
  HiddenPosts,
  KindData,
  KindDataChat,
  Story,
  WritDelta,
  WritDeltaAdd,
  WritDiff,
  checkNest,
  getChannelType,
  getTextContent,
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
import { poke, scry, subscribeOnce } from './urbit';

const logger = createDevLogger('postsApi', false);

export type Cursor = string | Date;
export type PostContent = (ub.Verse | ContentReference)[] | null;
export type PostContentAndFlags = [PostContent, db.PostFlags | null];

export function channelAction(
  nest: ub.Nest,
  action: ub.Action
): Poke<ub.ChannelsAction> {
  checkNest(nest);
  return {
    app: 'channels',
    mark: 'channel-action',
    json: {
      channel: {
        nest,
        action,
      },
    },
  };
}

export function chatAction(
  whom: string,
  id: string,
  delta: WritDelta
): Poke<DmAction | ClubAction> {
  if (whomIsDm(whom)) {
    const action: Poke<DmAction> = {
      app: 'chat',
      mark: 'chat-dm-action',
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
    mark: 'chat-club-action-0',
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
  const data = await subscribeOnce<ub.Said>({ app: 'channels', path }, 3000);
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

export function channelPostAction(nest: ub.Nest, action: ub.PostAction) {
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
  metadata,
}: {
  channelId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  metadata?: db.PostMetadata;
}) => {
  logger.log('sending post', { channelId, authorId, sentAt, content });
  const channelType = getChannelType(channelId);

  if (channelType === 'dm' || channelType === 'groupDm') {
    const delta: WritDeltaAdd = {
      add: {
        memo: {
          content,
          sent: sentAt,
          author: authorId,
        },
        kind: null,
        time: null,
      },
    };

    const action = chatAction(
      channelId,
      `${delta.add.memo.author}/${formatUd(unixToDa(delta.add.memo.sent).toString())}`,
      delta
    );
    await poke(action);
    return;
  }

  const essay = toPostEssay({
    content,
    authorId,
    sentAt,
    channelType,
    metadata,
  });

  await poke(
    channelPostAction(channelId, {
      add: essay,
    })
  );
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
}: {
  channelId: string;
  postId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  parentId?: string;
  metadata?: db.PostMetadata;
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
    metadata,
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
        id: `${authorId}/${formatUd(unixToDa(sentAt).toString())}`,
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

export type GetChannelPostsOptions = {
  channelId: string;
  count?: number;
  includeReplies?: boolean;
  mode: 'older' | 'newer' | 'around' | 'newest';
  cursor?: Cursor;
};

export interface GetChannelPostsResponse {
  older?: string | null;
  newer?: string | null;
  posts: db.Post[];
  deletedPosts?: string[];
  totalPosts?: number;
}

export const getChannelPosts = async ({
  channelId,
  cursor,
  mode = 'older',
  count = 20,
  includeReplies = false,
}: GetChannelPostsOptions) => {
  const type = getChannelIdType(channelId);
  const app = type === 'channel' ? 'channels' : 'chat';
  const path = formatScryPath(
    ...[
      type === 'dm' ? 'dm' : null,
      type === 'club' ? 'club' : null,
      type === 'channel' ? 'v1' : null,
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
    scry<ub.PagedWrits>({
      app,
      path,
    }),
    { posts: [] }
  );
  return toPagedPostsData(channelId, response);
};

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
  const { channels, dms } = await scry<ub.CombinedHeads>({
    app: 'groups-ui',
    path: formatScryPath(
      'v1/heads',
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
};

export interface GetChangedPostsOptions {
  channelId: string;
  afterCursor?: Cursor;
  count?: number;
}

export type GetChangedPostsResponse = GetChannelPostsResponse;

export const getChangedPosts = async ({
  channelId,
  afterCursor,
  count = 50,
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
      afterCursor ? formatCursor(afterCursor) : null,
      count
    ),
  });
  return toPagedPostsData(channelId, response);
};

export async function addReaction({
  channelId,
  postId,
  shortCode,
  our,
  postAuthor,
}: {
  channelId: string;
  postId: string;
  shortCode: string;
  our: string;
  postAuthor: string;
}) {
  const isDmOrGroupDm =
    isDmChannelId(channelId) || isGroupDmChannelId(channelId);

  if (isDmOrGroupDm) {
    if (isDmChannelId(channelId)) {
      await poke({
        app: 'chat',
        mark: 'chat-dm-action',
        json: {
          ship: channelId,
          diff: {
            id: `${channelId}/${postId}`,
            delta: {
              'add-react': {
                react: shortCode,
                ship: our,
              },
            },
          },
        },
      });
      return;
    } else {
      await poke({
        app: 'chat',
        mark: 'chat-club-action-0',
        json: {
          id: channelId,
          diff: {
            uid: '0v3',
            delta: {
              writ: {
                delta: {
                  'add-react': {
                    react: shortCode,
                    ship: our,
                  },
                },
                id: `${postAuthor}/${postId}`,
              },
            },
          },
        },
      });
      return;
    }
  }

  await poke({
    app: 'channels',
    mark: 'channel-action',
    json: {
      channel: {
        nest: channelId,
        action: {
          post: {
            'add-react': {
              id: postId,
              react: shortCode,
              ship: our,
            },
          },
        },
      },
    },
  });
}

export async function removeReaction({
  channelId,
  postId,
  our,
  postAuthor,
}: {
  channelId: string;
  postId: string;
  our: string;
  postAuthor: string;
}) {
  const isDmOrGroupDm =
    isDmChannelId(channelId) || isGroupDmChannelId(channelId);

  if (isDmOrGroupDm) {
    if (isDmChannelId(channelId)) {
      return poke({
        app: 'chat',
        mark: 'chat-dm-action',
        json: {
          ship: channelId,
          diff: {
            id: `${channelId}/${postId}`,
            delta: {
              'del-react': our,
            },
          },
        },
      });
    } else {
      return poke({
        app: 'chat',
        mark: 'chat-club-action-0',
        json: {
          id: channelId,
          diff: {
            uid: '0v3',
            delta: {
              writ: {
                delta: {
                  'del-react': our,
                },
                id: `${postAuthor}/${postId}`,
              },
            },
          },
        },
      });
    }
  }

  return await poke({
    app: 'channels',
    mark: 'channel-action',
    json: {
      channel: {
        nest: channelId,
        action: {
          post: {
            'del-react': {
              id: postId,
              ship: our,
            },
          },
        },
      },
    },
  });
}

export async function showPost(post: db.Post) {
  if (isGroupChannelId(post.channelId)) {
    const action = {
      app: 'channels',
      mark: 'channel-action',
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
      mark: 'channel-action',
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
    mark: 'group-action-3',
    json: {
      flag: groupId,
      update: {
        time: '',
        diff: {
          'flag-content': {
            nest: channelId,
            src: currentUserId,
            'post-key': {
              post: post.parentId ? post.parentId : post.id,
              reply: post.parentId ? post.id : null,
            },
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

export async function deletePost(channelId: string, postId: string) {
  const action = channelAction(channelId, {
    post: {
      del: postId,
    },
  });

  // todo: we need to use a tracked poke here (or settle on a different pattern
  // for expressing request response semantics)
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
    path = `/dm/${channelId}/writs/writ/id/${authorId}/${postId}`;
  } else if (isGroupDmChannelId(channelId)) {
    app = 'chat';
    path = `/club/${channelId}/writs/writ/id/${authorId}/${postId}`;
  } else if (isGroupChannelId(channelId)) {
    app = 'channels';
    path = `/v1/${channelId}/posts/post/${postId}`;
  } else {
    throw new Error('invalid channel id');
  }

  const post = await scry<ub.Post>({
    app,
    path,
  });

  return toPostData(channelId, post);
};

export interface DeletedPost {
  id: string;
  channelId: string;
}

export interface ChannelReference {
  type: 'reference';
  referenceType: 'channel';
  channelId: string;
  postId: string;
  replyId?: string;
}

export interface GroupReference {
  type: 'reference';
  referenceType: 'group';
  groupId: string;
}

export interface AppReference {
  type: 'reference';
  referenceType: 'app';
  userId: string;
  appId: string;
}

export type ContentReference = ChannelReference | GroupReference | AppReference;

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
): { posts: db.Post[]; deletedPosts: string[] } {
  const entries = Object.entries(posts);
  const deletedPosts: string[] = [];
  const otherPosts: db.Post[] = [];

  for (const [id, post] of entries) {
    if (post === null) {
      deletedPosts.push(id);
    } else {
      const postData = toPostData(channelId, post);
      otherPosts.push(postData);
    }
  }

  otherPosts.sort((a, b) => (a.receivedAt ?? 0) - (b.receivedAt ?? 0));

  return {
    posts: otherPosts,
    deletedPosts,
  };
}

export function toPostData(
  channelId: string,
  post: ub.Post | ub.Writ | ub.PostDataResponse
): db.Post {
  const getPostType = (
    channelId: string,
    post: ub.Post | ub.PostDataResponse
  ) => {
    if (isNotice(post)) {
      return 'notice';
    }

    const channelType = channelId.split('/')[0];

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
  const type = getPostType(channelId, post);
  const kindData = post?.essay['kind-data'];
  const [content, flags] = toPostContent(post?.essay.content);
  const metadata = parseKindData(kindData);
  const id = getCanonicalPostId(post.seal.id);
  const backendTime =
    post.seal && 'time' in post.seal
      ? getCanonicalPostId(post.seal.time.toString())
      : null;

  const replyData = isPostDataResponse(post)
    ? getReplyData(id, channelId, post)
    : null;

  return {
    id,
    channelId,
    type,
    backendTime,
    // Kind data will override
    title: metadata?.title ?? '',
    image: metadata?.image ?? '',
    authorId: post.essay.author,
    isEdited: 'revision' in post && post.revision !== '0',
    content: JSON.stringify(content),
    textContent: getTextContent(post?.essay.content),
    sentAt: post.essay.sent,
    receivedAt: getReceivedAtFromId(id),
    replyCount: post?.seal.meta.replyCount,
    replyTime: post?.seal.meta.lastReply,
    replyContactIds: post?.seal.meta.lastRepliers,
    images: getContentImages(id, post.essay?.content),
    reactions: toReactionsData(post?.seal.reacts ?? {}, id),
    replies: replyData,
    deliveryStatus: null,
    syncedAt: Date.now(),
    ...flags,
  };
}

function getReceivedAtFromId(postId: string) {
  return udToDate(postId.split('/').pop() ?? postId);
}

function isPostDataResponse(
  post: ub.Post | ub.PostDataResponse
): post is ub.PostDataResponse {
  return !!(post.seal.replies && !Array.isArray(post.seal.replies));
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
  reply: ub.Reply | ub.WritReply
): db.Post {
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
    authorId: reply.memo.author,
    isEdited: !!reply.revision && reply.revision !== '0',
    parentId: getCanonicalPostId(postId),
    reactions: toReactionsData(reply.seal.reacts, id),
    content: JSON.stringify(content),
    textContent: getTextContent(reply.memo.content),
    sentAt: reply.memo.sent,
    backendTime,
    receivedAt: getReceivedAtFromId(id),
    replyCount: 0,
    images: getContentImages(id, reply.memo.content),
    syncedAt: Date.now(),
    ...flags,
  };
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

function isNotice(post: ub.Post | ub.PostDataResponse | null) {
  const kindData = post?.essay['kind-data'];
  return (
    kindData &&
    isChatData(kindData) &&
    kindData.chat &&
    'notice' in kindData.chat
  );
}

function isChatData(data: KindData): data is KindDataChat {
  return 'chat' in (data ?? {});
}

export function getContentImages(postId: string, content?: ub.Story | null) {
  return (content || []).reduce<db.PostImage[]>((memo, story) => {
    if (ub.isBlock(story) && ub.isImage(story.block)) {
      memo.push({ ...story.block.image, postId });
    }
    return memo;
  }, []);
}

export function toReactionsData(
  reacts: Record<string, string>,
  postId: string
): db.Reaction[] {
  return Object.entries(reacts).map(([name, reaction]) => {
    return {
      contactId: name,
      postId,
      value: reaction,
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
