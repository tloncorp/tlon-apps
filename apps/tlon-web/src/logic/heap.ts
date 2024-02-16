/* eslint-disable */
import { JSONToInlines } from '@/logic/tiptap';
import { PostEssay, storyFromChatStory } from '@/types/channel';
import { ChatStory } from '@/types/channel';
import { Inline, InlineKey } from '@/types/content';
import { JSONContent } from '@tiptap/core';
import { reduce } from 'lodash';
import isURL from 'validator/lib/isURL';

import { isRef, pathToCite } from './utils';
import { isImageUrl } from './utils';

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: InlineKey): x is (typeof MERGEABLE_KEYS)[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
export function normalizeHeapInline(inline: Inline[]): Inline[] {
  return reduce(
    inline,
    (acc: Inline[], val) => {
      if (acc.length === 0) {
        return [...acc, val];
      }
      const last = acc[acc.length - 1];
      if (typeof last === 'string' && typeof val === 'string') {
        return [...acc.slice(0, -1), last + val];
      }
      const lastKey = Object.keys(acc[acc.length - 1])[0] as InlineKey;
      const currKey = Object.keys(val)[0] as keyof InlineKey;
      if (isMergeable(lastKey) && currKey === lastKey) {
        // @ts-expect-error keying weirdness
        const end: Inline = {
          // @ts-expect-error keying weirdness
          [lastKey]: [...last[lastKey as any], ...val[currKey as any]],
        };
        return [...acc.slice(0, -1), end];
      }
      return [...acc, val];
    },
    []
  );
}

export function jsonToHeartInline(json: JSONContent) {
  return normalizeHeapInline(JSONToInlines(json) as Inline[]);
}

export async function createCurioHeart(input: JSONContent | string) {
  let content: ChatStory = { inline: [], block: [] };
  if (typeof input === 'string' && isRef(input)) {
    const cite = pathToCite(input)!;
    content.block.push({ cite });
  } else if (typeof input === 'string' && isURL(input)) {
    if (isImageUrl(input)) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.src = input;

        img.onload = () => {
          const { width, height } = img;

          content.block.push({
            image: { src: input, width, height, alt: 'heap image' },
          });
          resolve();
        };
      });
    } else {
      content.inline.push({ link: { href: input, content: input } });
    }
  } else if (typeof input !== 'string') {
    content.inline = jsonToHeartInline(input);
  }

  const story = storyFromChatStory(content);

  return {
    'kind-data': {
      heap: '',
    },
    content: story,
    author: window.our,
    sent: Date.now(),
  };
}
