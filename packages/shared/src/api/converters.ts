import { daToUnix, decToUd, unixToDa } from '@urbit/api';
import { formatUd as baseFormatUd, parseUd } from '@urbit/aura';

import type * as db from '../db/types';
import type * as ub from '../urbit';
import { isColor } from './groupsApi';

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
