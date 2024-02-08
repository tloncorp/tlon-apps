import {
  daToUnix,
  parseDa,
  formatUd as baseFormatUd,
  parseUd,
  parseUx,
} from '@urbit/aura';
import * as db from '@db';
import * as ub from './types';

export interface PagedPostsData {
  older: string | null;
  newer: string | null;
  posts: db.Post[];
  totalPosts: number;
}

export function toPagedPostsData(
  channelId: string,
  data: ub.PagedPosts,
): PagedPostsData {
  return {
    older: data.older ? formatUd(data.older) : null,
    newer: data.newer ? formatUd(data.newer) : null,
    posts: toPostsData(channelId, data.posts),
    totalPosts: data.total,
  };
}

export function toPostsData(channelId: string, posts: ub.Posts): db.Post[] {
  return Object.entries(posts).map(([id, post]) => {
    return toPostData(id, channelId, post);
  });
}

export function toPostData(
  id: string,
  channelId: string,
  post: ub.Post | null,
): db.Post {
  const type = isNotice(post)
    ? 'notice'
    : (channelId.split('/')[0] as db.PostType);
  const kindData = post?.essay['kind-data'];
  const [content, flags] = toPostContent(post?.essay.content);
  return {
    id,
    type,
    // Kind data will override
    metadata: parseKindData(kindData),
    author: post?.essay.author,
    content: JSON.stringify(content),
    text: getTextContent(post?.essay.content),
    sentAt: post?.essay.sent,
    receivedAt: udToDate(id),
    replyCount: post?.seal.meta.replyCount,
    images: getPostImages(post),
    reactions: toReactionsData(post?.seal.reacts ?? {}),
    channel: {
      id: channelId,
    },
    ...flags,
  };
}

export function toPostContent(
  story?: ub.Story,
): [(ub.Verse | db.ContentReference)[] | null, db.PostFlags | null] {
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
  const convertedContent = story.map(verse => {
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

// TODO: This doesn't handle bait cites, does it need to?
export function toContentReference(cite: ub.Cite): db.ContentReference | null {
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
    return {type: 'reference', referenceType: 'group', groupId: cite.group};
  } else if ('desk' in cite) {
    const parts = cite.desk.flag.split('/');
    const userId = parts[0];
    const appId = parts[1];
    if (!userId || !appId) {
      console.error('found invalid ref', cite);
      return null;
    }
    return {type: 'reference', referenceType: 'app', userId, appId};
  }
  return null;
}

function getTextContent(story?: ub.Story | undefined) {
  if (!story) {
    return;
  }
  return story
    .map(verse => {
      if (ub.isBlock(verse)) {
        return getBlockContent(verse.block);
      } else {
        return getInlinesContent(verse.inline);
      }
    })
    .filter(v => !!v && v !== '')
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
    .filter(v => v && v !== '')
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
  return 'notice' in (post?.essay['kind-data'] ?? {});
}

function getPostImages(post: ub.Post | null) {
  return (post?.essay.content || []).reduce<db.Image[]>((memo, story) => {
    if (ub.isBlock(story) && ub.isImage(story.block)) {
      memo.push(story.block.image);
    }
    return memo;
  }, []);
}

function toReactionsData(reacts: Record<string, string>): db.Reaction[] {
  return Object.entries(reacts).map(([name, reaction]) => {
    return {
      name,
      reaction,
    };
  });
}

function udToDate(da: string) {
  return daToUnix(parseUd(da));
}

function daToDate(da: string) {
  return daToUnix(parseDa(da));
}

export function toGroupsData(groups: Record<string, ub.Group>) {
  return Object.entries(groups).map(([id, group]) => {
    return toGroupData(id, group);
  });
}

export function toGroupData(id: string, group: ub.Group): db.Group {
  return {
    id,
    ...toGroupMetadata(group),
    roles: Object.entries(group.cabals ?? {}).map(([name, role]) => {
      const data: db.GroupRole = {
        name,
        ...role.meta,
      };
      return data as db.GroupRole;
    }),
    navSections: group['zone-ord']
      ?.map(zoneId => {
        const zone = group.zones?.[zoneId];
        if (!zone) {
          return;
        }
        const data: db.GroupNavSection = {
          id: zoneId,
          channelIds: zone.idx,
          image: omitEmpty(zone.meta.image),
          title: omitEmpty(zone.meta.title),
          description: omitEmpty(zone.meta.description),
          cover: omitEmpty(zone.meta.cover),
        };
        return data;
      })
      .filter((s): s is db.GroupNavSection => !!s),
    members: Object.entries(group.fleet).map(([userId, vessel]) => {
      return toGroupMember(userId, vessel);
    }),
    channels: group.channels ? toGroupChannelsData(group.channels) : [],
  };
}

export function toGroupPreviewData(
  id: string,
  group: ub.Group | ub.GroupPreview,
): db.Group {
  return {
    id,
    isPreview: true,
    ...toGroupMetadata(group),
  };
}

function toGroupMetadata(group: ub.Group | ub.GroupPreview) {
  const iconImage = group.meta.image;
  const iconImageData = iconImage
    ? isColor(iconImage)
      ? {iconImageColor: iconImage}
      : {iconImage: iconImage}
    : {};
  const coverImage = group.meta.cover;
  const coverImageData = coverImage
    ? isColor(coverImage)
      ? {iconImageColor: coverImage}
      : {iconImage: coverImage}
    : {};
  return {
    isSecret: group.secret,
    title: group.meta.title,
    ...iconImageData,
    ...coverImageData,
    description: group.meta.description,
  };
}

function omitEmpty(val: string) {
  return val === '' ? undefined : val;
}

function isColor(value: string) {
  return value[0] === '#';
}

export function toApp(treaty: ub.Treaty): db.App {
  return {
    id: treaty.ship + '/' + treaty.desk,
    desk: treaty.desk,
    title: treaty.title,
    description: treaty.info,
    color: '#' + parseUx(treaty.color),
    image: treaty.image,
    website: treaty.website,
    license: treaty.license,
    version: treaty.version,
    publisherId: treaty.ship,
    updatedAt: daToDate(treaty.cass.da),
    hash: treaty.hash,
    ...toAppSource(treaty),
  };
}

function toAppSource(
  treaty: ub.Treaty,
): Pick<db.App, 'sourceBase' | 'sourceHash' | 'sourceType' | 'sourceUrl'> {
  if ('glob' in treaty.href) {
    const glob = treaty.href.glob;
    const ref = glob['glob-reference'];
    return {
      sourceBase: glob.base,
      sourceHash: ref.hash,
      sourceType: 'http' in ref.location ? 'httpGlob' : 'amesGlob',
      sourceUrl: 'http' in ref.location ? ref.location.http : ref.location.ames,
    };
  } else {
    return {
      sourceBase: treaty.href.site,
      sourceType: 'site',
      sourceUrl: treaty.href.site,
    };
  }
}

function toGroupChannelsData(channels: ub.GroupChannels): db.Channel[] {
  return Object.entries(channels).map(([id, channel]) =>
    toGroupChannelData(id, channel),
  );
}

function toGroupChannelData(id: string, channel: ub.GroupChannel): db.Channel {
  return {
    id,
    image: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    cover: omitEmpty(channel.meta.cover),
    description: omitEmpty(channel.meta.description),
  };
}

function toGroupMember(id: string, vessel: ub.Vessel) {
  return {
    id,
    roles: vessel.sects,
    joinedAt: vessel.joined,
  };
}

type ChannelUnreadData = {
  id: string;
  unreadState: db.ChannelUnreadState;
};

function toUnreadsData(unreads: ub.Unreads): ChannelUnreadData[] {
  return Object.entries(unreads).map(([id, unread]) => {
    return toUnreadData(id, unread);
  });
}

function toUnreadData(channelId: string, unread: ub.Unread): ChannelUnreadData {
  return {
    id: channelId,
    unreadState: {
      count: unread.count,
      firstUnreadId: unread['unread-id'] ?? undefined,
      unreadThreads: toThreadUnreadStateData(unread),
      updatedAt: unread.recency,
    },
  };
}

function toThreadUnreadStateData(unread: ub.Unread): db.ThreadUnreadState[] {
  return Object.entries(unread.threads).map(([threadId, unreadState]) => {
    return {
      threadId,
      count: unreadState.count,
      firstUnreadId: unreadState.id,
    };
  });
}

export const groups = {
  toLocal: toGroupsData,
};

export const group = {
  toLocal: toGroupData,
};

export const channelUnreads = {
  toLocal: toUnreadsData,
};

export function formatUd(ud: string) {
  //@ts-ignore string will get converted internally, so doesn't actually have to
  //be a bigint
  return baseFormatUd(ud);
}
