import { daToUnix, decToUd, unixToDa } from '@urbit/api';
import { formatUd as baseFormatUd, parseUd } from '@urbit/aura';

import type * as db from '../db/types';
import type * as ub from '../urbit';
import { BadResponseError } from './urbit';

export function formatScryPath(
  ...segments: (string | number | null | undefined)[]
) {
  return '/' + segments.filter((s) => !!s).join('/');
}

export function isColor(value: string) {
  return value[0] === '#';
}

export function toClientMeta(meta: ub.GroupMeta): db.ClientMeta {
  const iconImage = meta.image;
  const iconImageData = iconImage
    ? isColor(iconImage)
      ? { iconImageColor: iconImage }
      : { iconImage: iconImage }
    : {};
  const coverImage = meta.cover;
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

export function formatUd(ud: string) {
  // @ts-expect-error string will get converted internally, so doesn't actually have to
  //be a bigint
  return baseFormatUd(ud);
}

export function udToDate(da: string) {
  return daToUnix(parseUd(da));
}

export function formatDateParam(date: Date) {
  return baseFormatUd(unixToDa(date!.getTime()));
}

export function formatPostIdParam(sealId: string) {
  return decToUd(sealId);
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

export function toPostEssay({
  content,
  authorId,
  sentAt,
  channelType,
  metadata,
}: {
  content: ub.Story;
  authorId: string;
  sentAt: number;
  channelType: db.ChannelType;
  metadata?: db.PostMetadata;
}): ub.PostEssay {
  const kindData = (): ub.KindData => {
    if (!metadata) {
      switch (channelType) {
        case 'chat':
          return { chat: null };
        case 'notebook':
          throw new Error('Notebook posts must have a title');
        case 'gallery':
          return { heap: '' };
      }
    }

    if (channelType === 'chat') {
      return { chat: { notice: null } };
    }

    if (channelType === 'notebook') {
      if (!metadata!.title || metadata!.title === '') {
        throw new Error('Notebook posts must have a title');
      }
      return {
        diary: { title: metadata!.title, image: metadata!.image ?? '' },
      };
    }

    return { heap: metadata!.title ?? '' };
  };

  const essay: ub.PostEssay = {
    content,
    sent: sentAt,
    'kind-data': kindData(),
    author: authorId,
  };

  return essay;
}
