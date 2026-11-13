import type * as db from '../types/models';
import type * as ub from '../urbit';

export function isColor(value: string) {
  return value[0] === '#';
}

// Limit max image string size since this isn't currently limited serverside +
// it's possible for these to be massive and cause issues.
const maxImageStringSize = 2048;

export function toClientMeta(meta: ub.GroupMeta): db.ClientMeta {
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

export function fromClientMeta(meta: db.ClientMeta): ub.GroupMeta {
  return {
    title: meta.title ?? '',
    image: meta.iconImage ?? meta.iconImageColor ?? '',
    cover: meta.coverImage ?? meta.coverImageColor ?? '',
    description: meta.description ?? '',
  };
}
