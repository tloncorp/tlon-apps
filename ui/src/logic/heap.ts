/* eslint-disable */
import {
  CurioContent,
  CurioHeart,
  CurioInputMode,
  HeapInline,
  HeapInlineKey,
} from '@/types/heap';
import { isImageUrl, isRef, pathToCite } from './utils';
import isURL from 'validator/lib/isURL';
import { JSONContent } from '@tiptap/core';
import { JSONToInlines } from '@/logic/tiptap';
import { reduce } from 'lodash';

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: HeapInlineKey): x is (typeof MERGEABLE_KEYS)[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
export function normalizeHeapInline(inline: HeapInline[]): HeapInline[] {
  return reduce(
    inline,
    (acc: HeapInline[], val) => {
      if (acc.length === 0) {
        return [...acc, val];
      }
      const last = acc[acc.length - 1];
      if (typeof last === 'string' && typeof val === 'string') {
        return [...acc.slice(0, -1), last + val];
      }
      const lastKey = Object.keys(acc[acc.length - 1])[0] as HeapInlineKey;
      const currKey = Object.keys(val)[0] as keyof HeapInlineKey;
      if (isMergeable(lastKey) && currKey === lastKey) {
        // @ts-expect-error keying weirdness
        const end: HeapInline = {
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
  return normalizeHeapInline(JSONToInlines(json) as HeapInline[]);
}

export function createCurioHeart(input: JSONContent | string): CurioHeart {
  let content: CurioContent = { inline: [], block: [] };
  if (typeof input === 'string' && isRef(input)) {
    const cite = pathToCite(input)!;
    content.block.push({ cite });
  } else if (typeof input === 'string' && isURL(input)) {
    content.inline = [{ link: { href: input, content: input } }];
  } else if (typeof input !== 'string') {
    content.inline = jsonToHeartInline(input);
  }

  return {
    title: '',
    content,
    author: window.our,
    sent: Date.now(),
    replying: null,
  };
}
