import { daToUnix, unixToDa } from '@urbit/api';
import { formatUd as baseFormatUd, parseUd } from '@urbit/aura';

import * as db from '../db';
import * as ub from '../urbit';
import { KindData, KindDataChat } from '../urbit';
import { scry } from './urbit';

export const getChannelPosts = async (
  channelId: string,
  {
    cursor,
    date,
    direction = 'older',
    count = 20,
    includeReplies = false,
  }: {
    cursor?: string;
    date?: Date;
    direction?: 'older' | 'newer' | 'around';
    count?: number;
    includeReplies?: boolean;
  }
) => {
  if (cursor && date) {
    throw new Error('Cannot specify both cursor and date');
  }
  if (!cursor && !date) {
    throw new Error('Must specify either cursor or date');
  }
  const finalCursor = cursor ? cursor : formatDateParam(date!);
  const mode = includeReplies ? 'post' : 'outline';
  const path = `/${channelId}/posts/${direction}/${finalCursor}/${count}/${mode}`;
  const result = await scry<ub.PagedPosts>({ app: 'channels', path });
  return toPagedPostsData(channelId, result);
};

export interface PagedPostsData {
  older: string | null;
  newer: string | null;
  posts: db.PostInsert[];
  totalPosts: number;
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
  data: ub.PagedPosts
): PagedPostsData {
  return {
    older: data.older ? formatUd(data.older) : null,
    newer: data.newer ? formatUd(data.newer) : null,
    posts: toPostsData(channelId, data.posts),
    totalPosts: data.total,
  };
}

export function toPostsData(
  channelId: string,
  posts: ub.Posts
): db.PostInsert[] {
  return Object.entries(posts)
    .map(([id, post]) => {
      return toPostData(id, channelId, post);
    })
    .sort((a, b) => {
      return (a.receivedAt ?? 0) - (b.receivedAt ?? 0);
    });
}

export function toPostData(
  id: string,
  channelId: string,
  post: ub.Post | null
): db.PostInsert {
  const type = isNotice(post)
    ? 'notice'
    : (channelId.split('/')[0] as db.PostType);
  const kindData = post?.essay['kind-data'];
  const [content, flags] = toPostContent(post?.essay.content);
  const metadata = parseKindData(kindData);
  if (post === null) {
    return {
      id,
      type,
      title: '',
      image: '',
      authorId: '',
      content: '',
      textContent: '',
      sentAt: 0,
      receivedAt: udToDate(id),
      replyCount: 0,
      images: [],
      reactions: [],
      channel: {
        id: channelId,
      },
      ...flags,
    };
  }

  return {
    id,
    type,
    // Kind data will override
    title: metadata?.title ?? '',
    image: metadata?.image ?? '',
    authorId: post.essay.author,
    content: JSON.stringify(content),
    textContent: getTextContent(post?.essay.content),
    sentAt: post.essay.sent,
    receivedAt: udToDate(id),
    replyCount: post?.seal.meta.replyCount,
    images: getPostImages(post),
    reactions: toReactionsData(post?.seal.reacts ?? {}, id),
    channel: {
      id: channelId,
    },
    ...flags,
  };
}

export function toPostContent(
  story?: ub.Story
): [(ub.Verse | ContentReference)[] | null, db.PostFlags | null] {
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

function getTextContent(story?: ub.Story | undefined) {
  if (!story) {
    return;
  }
  return story
    .map((verse) => {
      if (ub.isBlock(verse)) {
        return getBlockContent(verse.block);
      } else {
        return getInlinesContent(verse.inline);
      }
    })
    .filter((v) => !!v && v !== '')
    .join(' ')
    .trim();
}

function getBlockContent(block: ub.Block) {
  if (ub.isImage(block)) {
    return '[image]';
  } else if (ub.isCite(block)) {
    return '[ref]';
  } else if (ub.isHeader(block)) {
    return block.header.content.map(getInlineContent);
  } else if (ub.isCode(block)) {
    return block.code.code;
  } else if (ub.isListing(block)) {
    return getListingContent(block.listing);
  }
}

function getListingContent(listing: ub.Listing): string {
  if (ub.isListItem(listing)) {
    return listing.item.map(getInlineContent).join(' ');
  } else {
    return listing.list.items.map(getListingContent).join(' ');
  }
}

function getInlinesContent(inlines: ub.Inline[]): string {
  return inlines
    .map(getInlineContent)
    .filter((v) => v && v !== '')
    .join(' ');
}

function getInlineContent(inline: ub.Inline): string {
  if (ub.isBold(inline)) {
    return inline.bold.map(getInlineContent).join(' ');
  } else if (ub.isItalics(inline)) {
    return inline.italics.map(getInlineContent).join(' ');
  } else if (ub.isLink(inline)) {
    return inline.link.content;
  } else if (ub.isStrikethrough(inline)) {
    return inline.strike.map(getInlineContent).join(' ');
  } else if (ub.isBlockquote(inline)) {
    return inline.blockquote.map(getInlineContent).join(' ');
  } else if (ub.isInlineCode(inline)) {
    return inline['inline-code'];
  } else if (ub.isBlockCode(inline)) {
    return inline.code;
  } else if (ub.isBreak(inline)) {
    return '';
  } else if (ub.isShip(inline)) {
    return inline.ship;
  } else if (ub.isTag(inline)) {
    return inline.tag;
  } else if (ub.isBlockReference(inline)) {
    return inline.block.text;
  } else if (ub.isTask(inline)) {
    return inline.task.content.map(getInlineContent).join(' ');
  } else {
    return inline;
  }
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

function isNotice(post: ub.Post | null) {
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

function getPostImages(post: ub.Post | null) {
  return (post?.essay.content || []).reduce<db.PostImage[]>((memo, story) => {
    if (ub.isBlock(story) && ub.isImage(story.block)) {
      memo.push({ ...story.block.image, postId: post!.seal.id });
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

// Utilities

function formatUd(ud: string) {
  //@ts-ignore string will get converted internally, so doesn't actually have to
  //be a bigint
  return baseFormatUd(ud);
}

function udToDate(da: string) {
  return daToUnix(parseUd(da));
}

function formatDateParam(date: Date) {
  return baseFormatUd(unixToDa(date!.getTime()));
}
