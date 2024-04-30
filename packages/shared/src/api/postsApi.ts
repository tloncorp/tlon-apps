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
import { formatDateParam, formatUd, udToDate } from './converters';
import { BadResponseError, poke, scry } from './urbit';

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
  if (isDmChannelId(channelId)) {
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

export const getChannelPosts = async ({
  channelId,
  cursor,
  date,
  direction = 'older',
  count = 20,
  includeReplies = false,
}: {
  channelId: string;
  cursor?: string;
  date?: Date;
  direction?: 'older' | 'newer' | 'around';
  count?: number;
  includeReplies?: boolean;
}) => {
  if (cursor && date) {
    throw new Error('Cannot specify both cursor and date');
  }
  if (!cursor && !date) {
    throw new Error('Must specify either cursor or date');
  }
  const finalCursor = cursor ? cursor : formatDateParam(date!);
  let app: 'chat' | 'channels';
  let path: string;

  if (isDmChannelId(channelId)) {
    const mode = includeReplies ? 'heavy' : 'light';
    app = 'chat';
    path = `/dm/${channelId}/writs/${direction}/${finalCursor}/${count}/${mode}`;
  } else if (isGroupDmChannelId(channelId)) {
    const mode = includeReplies ? 'heavy' : 'light';
    path = `/club/${channelId}/writs/${direction}/${finalCursor}/${count}/${mode}`;
    app = 'chat';
  } else if (isGroupChannelId(channelId)) {
    const mode = includeReplies ? 'post' : 'outline';
    path = `/v1/${channelId}/posts/${direction}/${finalCursor}/${count}/${mode}`;
    app = 'channels';
  } else {
    throw new Error('invalid channel id');
  }

  const response = await with404Handler(
    scry<ub.PagedWrits>({
      app,
      path,
    }),
    { posts: [] }
  );
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
    (!authorId && isDmChannelId(channelId)) ||
    isGroupDmChannelId(channelId)
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

async function with404Handler<T>(scryRequest: Promise<any>, defaultValue: T) {
  try {
    return await scryRequest;
  } catch (e) {
    if (e instanceof BadResponseError && e.status === 404) {
      return defaultValue;
    }
    throw e;
  }
}

export interface GetChannelPostsResponse {
  older?: string | null;
  newer?: string | null;
  posts: db.Post[];
  deletedPosts?: string[];
  totalPosts?: number;
}

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
  const type = isNotice(post)
    ? 'notice'
    : (channelId.split('/')[0] as db.PostType);
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
    ...flags,
  };
}

export function buildCachePost({
  authorId,
  channel,
  content,
}: {
  authorId: string;
  channel: db.Channel;
  content: ub.Story;
}): db.Post {
  const sentAt = Date.now();
  const id = unixToDa(sentAt).toString();
  const [postContent, postFlags] = toPostContent(content);

  return {
    id,
    authorId,
    channelId: channel.id,
    groupId: channel.groupId,
    type: channel.id.split('/')[0] as db.PostType,
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
    ...postFlags,
  };
}

export function getCanonicalPostId(inputId: string) {
  let id = inputId;
  // Dm and club posts come prefixed with the author, so we strip it
  if (id[0] === '~') {
    id = id.split('/').pop()!;
  }
  // The id in group post ids doesn't come dot separated, so we format it
  if (id[3] !== '.') {
    id = formatUd(id);
  }
  return id;
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
  return Object.entries(post.seal.replies ?? {}).map(([, reply]) => {
    const [content, flags] = toPostContent(reply.memo.content);
    const id = reply.seal.id;
    return {
      id,
      channelId,
      type: 'reply',
      authorId: reply.memo.author,
      parentId: postId,
      reactions: toReactionsData(reply.seal.reacts, id),
      content: JSON.stringify(content),
      textContent: getTextContent(reply.memo.content),
      sentAt: reply.memo.sent,
      receivedAt: getReceivedAtFromId(id),
      replyCount: 0,
      images: getContentImages(id, reply.memo.content),
      ...flags,
    };
  });
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

function toReactionsData(
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

function isDmChannelId(channelId: string) {
  return channelId.startsWith('~');
}

function isGroupDmChannelId(channelId: string) {
  return channelId.startsWith('0v');
}

function isGroupChannelId(channelId: string) {
  return (
    channelId.startsWith('chat') ||
    channelId.startsWith('diary') ||
    channelId.startsWith('heap')
  );
}
