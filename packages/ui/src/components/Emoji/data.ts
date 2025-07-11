import EmojiData, { EmojiMartData } from '@emoji-mart/data';
import { createDevLogger } from '@tloncorp/shared';
import Fuse from 'fuse.js';
import { useMemo } from 'react';

const logger = createDevLogger('EmojiData', false);

export type EmojiObject = {
  id: string;
  name: string;
  keywords: string[];
  skins: { native: string }[];
};

const eIndex = processEmojiData();
export const EMOJI_MAP = Object.freeze(eIndex.emojiMap);
export const ALL_EMOJIS = Object.freeze(eIndex.emojiKeys);
export const ALL_EMOJI_VALUES = Object.freeze(eIndex.emojiValues);

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
  ALL_EMOJI_VALUES
);
const fuse = new Fuse(ALL_EMOJI_VALUES, emojiSearchOptions, emojiSearchIndex);

// first used early in the app to precompute the index
// before it's needed
export function usePreloadedEmojis() {
  return useMemo(() => ALL_EMOJIS, []);
}

export function getNativeEmoji(input: string): string | undefined {
  try {
    // if it's a shortcode, transform it to a native emoji
    const sanitizedShortcode = input.replace(/^:|:$/g, '');
    const shortcodeEmoji = EMOJI_MAP[sanitizedShortcode]?.skins[0].native;
    if (shortcodeEmoji) {
      return shortcodeEmoji;
    }

    // otherwise just make sure it's vaguely "emoji shaped" (i.e. not long text)
    const fancyCharCount = Array.from(
      input.split(/[\ufe00-\ufe0f]/).join('')
    ).length;
    const conservativeEmojiMaxLength = 4;
    if (fancyCharCount > conservativeEmojiMaxLength) {
      throw new Error('Invalid non-shortcode emoji input');
    }
    return input;
  } catch (e) {
    logger.trackError('Error parsing emoji shortcode', {
      input,
      error: e.toString(),
    });
    return '🛑';
  }
}

export function searchEmojis(query: string): EmojiObject[] {
  if (!query) return Object.values(EMOJI_MAP);
  return fuse.search(query).map((result) => result.item);
}

function processEmojiData() {
  const emojiMap = Object.entries((EmojiData as EmojiMartData).emojis).reduce(
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
  const emojiEntries = Object.entries(emojiMap);

  // handle exceptions in the default ordering
  const [hundredEmoji, countingEmoj] = emojiEntries.splice(0, 2);

  const boomIndex = emojiEntries.findIndex(([key]) => key === 'boom');
  if (boomIndex !== -1) {
    emojiEntries.splice(boomIndex + 1, 0, hundredEmoji);
  }

  const abcdIndex = emojiEntries.findIndex(([key]) => key === 'abcd');
  if (abcdIndex !== -1) {
    emojiEntries.splice(abcdIndex + 1, 0, countingEmoj);
  }

  return {
    emojiMap,
    emojiEntries,
    emojiKeys: emojiEntries.map(([key]) => key),
    emojiValues: emojiEntries.map(([, value]) => value),
  };
}
