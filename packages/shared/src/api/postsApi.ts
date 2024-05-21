import { unixToDa } from '@urbit/api';
import { Poke } from '@urbit/http-api';

import * as db from '../db';
import * as ub from '../urbit';
import {
  ClubAction,
  DmAction,
  KindData,
  KindDataChat,
  Story,
  WritDelta,
  WritDeltaAdd,
  WritDiff,
  checkNest,
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
  udToDate,
  with404Handler,
} from './apiUtils';
import { poke, scry } from './urbit';

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
}: {
  channelId: string;
  authorId: string;
  sentAt: number;
  content: Story;
}) => {
  if (isDmChannelId(channelId) || isGroupDmChannelId(channelId)) {
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

  const essay: ub.PostEssay = {
    content,
    sent: sentAt,
    'kind-data': {
      chat: null,
    },
    author: authorId,
  };

  await poke(
    channelPostAction(channelId, {
      add: essay,
    })
  );
};

export const editPost = async ({
  channelId,
  postId,
  authorId,
  sentAt,
  content,
  parentId,
}: {
  channelId: string;
  postId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  parentId?: string;
}) => {
  if (isDmChannelId(channelId) || isGroupDmChannelId(channelId)) {
    throw new Error('Cannot edit a post in a DM or group DM');
  }

  if (parentId) {
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

    await poke(channelAction(channelId, action));
    return;
  }

  const essay: ub.PostEssay = {
    author: authorId,
    content,
    sent: sentAt,
    'kind-data': {
      chat: null,
    },
  };

  const action = channelPostAction(channelId, {
    edit: {
      id: postId,
      essay,
    },
  });

  await poke(action);
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
} & (
  | { cursor: Cursor; mode: 'older' | 'newer' | 'around' }
  | { cursor?: never; mode: 'newest' }
);

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
  type,
}: {
  afterCursor?: Cursor;
  count?: number;
  type: 'channels' | 'chats';
}): Promise<GetLatestPostsResponse> => {
  const response = await scry<ub.ChannelHeadsResponse | ub.ChatHeadsResponse>({
    app: type === 'channels' ? 'channels' : 'chat',
    path: formatScryPath(
      type === 'channels' ? 'v2' : null,
      'heads',
      afterCursor ? formatCursor(afterCursor) : null,
      count
    ),
  });
  return response.map((head) => {
    const channelId = 'nest' in head ? head.nest : head.whom;
    return {
      channelId: channelId,
      updatedAt: head.recency,
      latestPost: toPostData(channelId, head.latest),
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

export async function addReaction(
  channelId: string,
  postId: string,
  shortCode: string,
  our: string
) {
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

export async function removeReaction(
  channelId: string,
  postId: string,
  our: string
) {
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

export async function showPost(channelId: string, postId: string) {
  const action = {
    app: 'channels',
    mark: 'channel-action',
    json: {
      'toggle-post': {
        show: postId,
      },
    },
  };

  return await poke(action);
}

export async function hidePost(channelId: string, postId: string) {
  const action = {
    app: 'channels',
    mark: 'channel-action',
    json: {
      'toggle-post': {
        hide: postId,
      },
    },
  };

  return await poke(action);
}

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
  return {
    older: data.older ? formatUd(data.older) : null,
    newer: data.newer ? formatUd(data.newer) : null,
    totalPosts: data.total,
    ...toPostsData(channelId, posts),
  };
}

export function toPostsData(
  channelId: string,
  posts: ub.Posts | Record<string, ub.Reply>
) {
  const [deletedPosts, otherPosts] = Object.entries(posts).reduce<
    [string[], db.Post[]]
  >(
    (memo, [id, post]) => {
      if (post === null) {
        memo[0].push(id);
      } else {
        memo[1].push(toPostData(channelId, post));
      }
      return memo;
    },
    [[], []]
  );
  return {
    posts: otherPosts.sort((a, b) => {
      return (a.receivedAt ?? 0) - (b.receivedAt ?? 0);
    }),
    deletedPosts,
  };
}

export function toPostData(
  channelId: string,
  post: ub.Post | ub.PostDataResponse
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

  return {
    id,
    channelId,
    type,
    // Kind data will override
    title: metadata?.title ?? '',
    image: metadata?.image ?? '',
    authorId: post.essay.author,
    isEdited: !!post.revision && post.revision !== '0',
    content: JSON.stringify(content),
    textContent: getTextContent(post?.essay.content),
    sentAt: post.essay.sent,
    receivedAt: getReceivedAtFromId(id),
    replyCount: post?.seal.meta.replyCount,
    replyTime: post?.seal.meta.lastReply,
    replyContactIds: post?.seal.meta.lastRepliers,
    images: getContentImages(id, post.essay?.content),
    reactions: toReactionsData(post?.seal.reacts ?? {}, id),
    replies: isPostDataResponse(post)
      ? getReplyData(id, channelId, post)
      : null,
    deliveryStatus: null,
    ...flags,
  };
}

export function buildCachePost({
  authorId,
  channel,
  content,
  parentId,
}: {
  authorId: string;
  channel: db.Channel;
  content: ub.Story;
  parentId?: string;
}): db.Post {
  const sentAt = Date.now();
  const id = getCanonicalPostId(unixToDa(sentAt).toString());
  const [postContent, postFlags] = toPostContent(content);

  // TODO: punt on DM delivery status until we have a single subscription
  // to lean on
  const deliveryStatus =
    isDmChannelId(channel.id) || isGroupDmChannelId(channel.id)
      ? null
      : 'pending';

  return {
    id,
    authorId,
    channelId: channel.id,
    groupId: channel.groupId,
    type: parentId ? 'reply' : (channel.id.split('/')[0] as db.PostType),
    sentAt,
    receivedAt: sentAt,
    title: '',
    image: '',
    content: JSON.stringify(postContent),
    textContent: getTextContent(content),
    images: getContentImages(id, content),
    reactions: [],
    replies: [],
    replyContactIds: [],
    replyCount: 0,
    hidden: false,
    parentId,
    deliveryStatus,
    ...postFlags,
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

export function toPostReplyData(
  channelId: string,
  postId: string,
  reply: ub.Reply
): db.Post {
  const [content, flags] = toPostContent(reply.memo.content);
  const id = getCanonicalPostId(reply.seal.id);
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
    receivedAt: getReceivedAtFromId(id),
    replyCount: 0,
    images: getContentImages(id, reply.memo.content),
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

export function toContentReference(cite: ub.Cite): ContentReference | null {
  if ('chan' in cite) {
    const channelId = cite.chan.nest;
    const postId = cite.chan.where.split('/')[2];
    if (!postId) {
      console.error('found invalid ref', cite);
      return null;
    }
    const replyId = cite.chan.where.split('/')[3];
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

function getContentImages(postId: string, content?: ub.Story | null) {
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
