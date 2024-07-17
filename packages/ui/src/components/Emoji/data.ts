import EmojiData, { EmojiMartData } from '@emoji-mart/data';
import Fuse from 'fuse.js';
import { useMemo } from 'react';

export type EmojiObject = {
  id: string;
  name: string;
  keywords: string[];
  skins: { native: string }[];
};

export const EMOJI_MAP = Object.freeze(
  Object.entries((EmojiData as EmojiMartData).emojis).reduce(
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
  )
);

export const ALL_EMOJIS = Object.freeze(Object.keys(EMOJI_MAP));

export function usePreloadedEmojis() {
  return useMemo(() => ALL_EMOJIS, []);
}

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

const emojiSearchOptions = {
  keys: [
    { name: 'id', weight: 1 },
    { name: 'name', weight: 2 },
    { name: 'keywords', weight: 1.5 },
  ],
  threshold: 0.2,
};
const emojiSearchIndex = Fuse.createIndex(
  emojiSearchOptions.keys,
  Object.values(EMOJI_MAP)
);
const fuse = new Fuse(
  Object.values(EMOJI_MAP),
  emojiSearchOptions,
  emojiSearchIndex
);

export function searchEmojis(query: string): EmojiObject[] {
  if (!query) return Object.values(EMOJI_MAP);
  return fuse.search(query).map((result) => result.item);
}
