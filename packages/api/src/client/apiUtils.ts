import {
  render,
  da
} from '@urbit/aura';
import bigInt from 'big-integer';

import { getCanonicalPostId, parseIdNumber } from '../lib/id';
import * as api from '../types';
import type * as ub from '../urbit';
import type * as dm from '../urbit/dms';
import { BadResponseError } from './urbit';

export { getCanonicalPostId, parseIdNumber };

export function formatScryPath(
  ...segments: (string | number | null | undefined)[]
) {
  return '/' + segments.filter((s) => !!s).join('/');
}

export function isColor(value: string) {
  return value[0] === '#';
}

// Limit max image string size since this isn't currently limited serverside +
// it's possible for these to be massive and cause issues.
const maxImageStringSize = 2048;

export function toClientMeta(meta: ub.GroupMeta): api.ClientMeta {
  const iconImage = meta.image.length > maxImageStringSize ? '' : meta.image;
  const iconImageData = iconImage
    ? isColor(iconImage)
      ? { iconImageColor: iconImage }
      : { iconImage: iconImage }
    : {};
  const coverImage = meta.cover.length > maxImageStringSize ? '' : meta.cover;
  const coverImageData = coverImage
    ? isColor(coverImage)
      ? { coverImageColor: coverImage }
      : { coverImage: coverImage }
    : {};
  return {
    title: meta.title,
    iconImage: iconImageData.iconImage ?? null,
    iconImageColor: iconImageData.iconImageColor ?? null,
    coverImage: coverImageData.coverImage ?? null,
    coverImageColor: coverImageData.coverImageColor ?? null,
    description: meta.description,
  };
}

export function fromClientMeta(meta: api.ClientMeta): ub.GroupMeta {
  return {
    title: meta.title ?? '',
    image: meta.iconImage ?? meta.iconImageColor ?? '',
    cover: meta.coverImage ?? meta.coverImageColor ?? '',
    description: meta.description ?? '',
  };
}

export function formatUd(ud: string) {  //REVIEW
  return render('ud', BigInt(ud));
}

export function udToDate(das: string) {
  return da.toUnix(parseIdNumber(das));
}

//  parses either a @ud-formatted string (dot-separated decimal) or a plain
//  decimal number string (aka @ui without the prefix).
//  we try both instead of being precise at the callsites, because historically
//  we used a too-lenient @ud parser, which also accepted dotless
//  representations, making it slightly unclear/ambiguous what we were actually
//  *intending* to parse. the backend is wildly inconsistent, so this is easier
//  and safer than figuring all that out. (we'll tighten things up Soon™.)
export function formatDateParam(date: Date) {
  return render('ud', da.fromUnix(date!.getTime()));
}

export function isDmChannelId(channelId: string) {
  return channelId.startsWith('~');
}

export function isGroupDmChannelId(channelId: string) {
  return channelId.startsWith('0v');
}

export function isGroupChannelId(channelId: string) {
  return (
    channelId.startsWith('chat') ||
    channelId.startsWith('diary') ||
    channelId.startsWith('heap')
  );
}

export function parseGroupChannelId(channelId: string) {
  const parts = channelId.split('/');
  return {
    kind: parts[0] as ub.Kind,
    host: parts[1] as string,
    name: parts[2] as string,
  };
}

export function parseGroupId(groupId: string) {
  const parts = groupId.split('/');
  return {
    host: parts[0] as string,
    name: parts[1] as string,
  };
}

export function getChannelIdType(channelId: string) {
  if (isDmChannelId(channelId)) {
    return 'dm';
  } else if (isGroupDmChannelId(channelId)) {
    return 'club';
  } else if (isGroupChannelId(channelId)) {
    return 'channel';
  } else {
    throw new Error('invalid channel id');
  }
}

// distinguish between channel and group IDs
export function isChannelId(id: string): boolean {
  // if has no path parts, is a dm or multi-dm
  if (id.split('/').length === 1) {
    return true;
  }

  // otherwise, check if its a group channel
  return isGroupChannelId(id);
}

export async function with404Handler<T>(
  scryRequest: Promise<any>,
  defaultValue: T
) {
  try {
    return await scryRequest;
  } catch (e) {
    if (e instanceof BadResponseError && e.status === 404) {
      return defaultValue;
    }
    throw e;
  }
}
export function toPostEssay({
  content,
  authorId,
  sentAt,
  channelType,
  blob,
  metadata,
  botProfile,
}: {
  content: ub.Story;
  authorId: string;
  sentAt: number;
  channelType: api.ChannelType;
  blob?: string;
  metadata?: ub.Metadata;
  botProfile?: { nickname?: string | null; avatar?: string | null };
}): ub.PostEssay {
  // If botProfile is provided, use BotProfile author format
  const author: ub.Author = botProfile
    ? {
        ship: authorId,
        nickname: botProfile.nickname ?? null,
        avatar: botProfile.avatar ?? null,
      }
    : authorId;

  const essay: ub.PostEssay = {
    content,
    sent: sentAt,
    kind:
      channelType === 'notebook'
        ? '/diary'
        : channelType === 'gallery'
          ? '/heap'
          : '/chat',
    author,
    blob: blob || null,
    meta: metadata || null,
  };

  return essay;
}

// the chat subscription doesn't include full posts (writs) in its add events,
// so we need to recreate the implicit msising data before inserting them
export function deriveFullWrit(
  id: string,
  delta: dm.WritDeltaAdd | dm.WritResponseAdd
): dm.DmWrit {
  const time = delta.add.time
    ? bigInt(delta.add.time).toString()
    : da.fromUnix(delta.add.essay.sent).toString();

  const seq = delta.add.seq ?? undefined;

  const seal: dm.DmWritSeal = {
    id,
    time,
    replies: [],
    reacts: {},
    meta: {
      replyCount: 0,
      lastRepliers: [],
      lastReply: null,
    },
    seq,
  };

  return { seal, essay: delta.add.essay, type: 'writ' };
}

export function deriveFullWritReply({
  id,
  parentId,
  delta,
}: {
  id: string;
  parentId: string;
  delta: dm.ReplyDeltaAdd;
}): dm.WritReply {
  const time = delta.add.time
    ? bigInt(delta.add.time).toString()
    : da.fromUnix(delta.add.memo.sent).toString();

  const seal: dm.WritReplySeal = {
    id,
    time,
    'parent-id': parentId,
    reacts: {},
  };
  const memo = delta.add.memo;

  return { seal, memo };
}
