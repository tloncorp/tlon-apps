import EmojiData, { EmojiMartData } from '@emoji-mart/data';
import Fuse from 'fuse.js';

export type EmojiObject = {
  id: string;
  name: string;
  keywords: string[];
  skins: { native: string }[];
};

export const EMOJI_MAP = Object.entries(
  (EmojiData as EmojiMartData).emojis
).reduce(
  (acc, [key, value]) => {
    acc[key] = {
      id: key,
      name: value.name,
      keywords: value.keywords,
      skins: value.skins,
    };
    return acc;
  },
  {} as Record<string, EmojiObject>
);

export const ALL_EMOJIS = Object.keys(EMOJI_MAP);

export function getNativeEmoji(shortcode: string) {
  const sanitizedShortcode = shortcode.replace(/^:|:$/g, '');
  try {
    return (EmojiData as EmojiMartData).emojis[sanitizedShortcode]?.skins[0]
      .native;
  } catch (e) {
    console.error(`Parsing emoji shortcode ${shortcode} failed: ${e}`);
    return '🛑';
  }
}

const fuseOptions = {
  keys: [
    { name: 'id', weight: 1 },
    { name: 'name', weight: 2 },
    { name: 'keywords', weight: 1.5 },
  ],
  threshold: 0.2,
};
export const fuse = new Fuse(Object.values(EMOJI_MAP), fuseOptions);

export function searchEmojis(query: string): EmojiObject[] {
  if (!query) return Object.values(EMOJI_MAP);
  return fuse.search(query).map((result) => result.item);
}
