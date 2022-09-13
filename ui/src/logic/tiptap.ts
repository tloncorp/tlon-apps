import { Inline, InlineKey } from '@/types/content';
import { reduce } from 'lodash';
import { JSONContent } from '@tiptap/react';
import {
  Editor,
  Extension,
  KeyboardShortcutCommand,
  PasteRule,
} from '@tiptap/core';
import { Cite } from '@/types/chat';
import { DiaryBlock, NoteContent } from '@/types/diary';
import { citeToPath, pathToCite } from './utils';

export interface EditorOnUpdateProps {
  editor: Editor;
  transaction: any;
}

export interface EditorOnBlurProps {
  editor: Editor;
}

export function Shortcuts(bindings: {
  [keyCode: string]: KeyboardShortcutCommand;
}) {
  return Extension.create({
    priority: 999999,
    addKeyboardShortcuts() {
      return bindings;
    },
  });
}

export function convertMarkType(type: string): string {
  switch (type) {
    case 'italic':
      return 'italics';
    case 'code':
      return 'inline-code';
    case 'link':
      return 'href';
    default:
      return type;
  }
}

export function convertTipTapType(type: string): string {
  switch (type) {
    case 'italics':
      return 'italic';
    case 'inline-code':
      return 'code';
    default:
      return type;
  }
}

export function tipTapToString(json: JSONContent): string {
  if (json.content) {
    if (json.content.length === 1) {
      if (json.type === 'blockquote') {
        const parsed = tipTapToString(json.content[0]);
        return Array.isArray(parsed)
          ? parsed.reduce((sum, item) => sum + item, '')
          : parsed;
      }

      return tipTapToString(json.content[0]);
    }

    return json.content.reduce((sum, item) => sum + tipTapToString(item), '');
  }

  if (json.marks && json.marks.length > 0) {
    const first = json.marks.pop();

    if (!first) {
      throw new Error('Unsure what this is');
    }

    if (first.type === 'link' && first.attrs) {
      return first.attrs.href;
    }

    return tipTapToString(json);
  }

  return json.text || '';
}

// Limits the amount of consecutive breaks to 2 or less
function limitBreaks(
  inlines: (Inline | DiaryBlock)[],
  maxBreaks = 2
): (Inline | DiaryBlock)[] {
  return inlines.reduce(
    (memo, inline) => {
      // not a break
      if (typeof inline === 'string' || !('break' in inline)) {
        return { count: 0, result: [...memo.result, inline] };
      }

      // is a break
      // consider the running count of consecutive breaks; if 2 or more, drop it
      if (memo.count < maxBreaks) {
        return { count: memo.count + 1, result: [...memo.result, inline] };
      }

      return { count: memo.count + 1, result: memo.result };
    },
    { count: 0, result: [] as (Inline | DiaryBlock)[] }
  ).result;
}

export function JSONToInlines(json: JSONContent): (Inline | DiaryBlock)[] {
  switch (json.type) {
    case 'text': {
      // unstyled / marks base case
      if (!json.marks || json.marks.length === 0) {
        return [json.text ?? ''];
      }

      // styled
      const first = json.marks.pop();
      if (!first) {
        return [];
      }

      // inline code special case
      if (
        json.text &&
        (first.type === 'code' || json.marks.find((m) => m.type === 'code'))
      ) {
        return [
          {
            'inline-code': json.text,
          },
        ];
      }

      // link special case
      if (first.type === 'link' && first.attrs) {
        return [
          {
            link: {
              href: first.attrs.href,
              content: json.text || first.attrs.href,
            },
          },
        ];
      }

      return [
        {
          [convertMarkType(first.type)]: JSONToInlines(json),
        },
      ] as unknown as (Inline | DiaryBlock)[];
    }
    case 'paragraph': {
      // newline
      if (!json.content) {
        return [{ break: null }];
      }

      const inlines = json.content.reduce(
        (memo, c) => memo.concat(JSONToInlines(c)),
        [] as (Inline | DiaryBlock)[]
      );
      return limitBreaks(inlines);
    }
    case 'doc': {
      if (!json.content) {
        return [];
      }

      const inlines = json.content.reduce(
        (memo, c) => memo.concat(JSONToInlines(c)),
        [] as (Inline | DiaryBlock)[]
      );
      return limitBreaks(inlines);
    }
    case 'blockquote': {
      const inlines =
        json.content?.reduce(
          (memo, c) => memo.concat(JSONToInlines(c)),
          [] as (Inline | DiaryBlock)[]
        ) ?? [];
      return [
        {
          blockquote: limitBreaks(inlines) as Inline[],
        },
      ];
    }
    case 'codeBlock': {
      if (!json.content || json.content.length === 0) {
        return [];
      }
      return [
        {
          code: json.content[0].text ?? '',
        },
      ];
    }
    case 'diary-image': {
      if (!json.attrs) {
        return [];
      }
      return [
        {
          image: {
            src: json.attrs.src,
            alt: json.attrs.alt,
            height: json.attrs.height,
            width: json.attrs.width,
          },
        },
      ];
    }
    case 'diary-cite': {
      if (!json.attrs) {
        return [];
      }
      const cite = pathToCite(json.attrs.path);
      if (!cite) {
        return [''];
      }

      return [{ cite }];
    }
    case 'diary-link': {
      if (!json.attrs) {
        return [];
      }
      return [
        {
          link: {
            href: json.attrs.href,
            content: json.attrs.title || json.attrs.href,
          },
        },
      ];
    }
    default: {
      return [];
    }
  }
}

const makeText = (t: string) => ({ type: 'text', text: t });
const makeParagraph = (content?: JSONContent[]): JSONContent => {
  const p = { type: 'paragraph' };
  if (!content) {
    return p;
  }
  return { ...p, content };
};
const makeMarks = (k: InlineKey) => ({ type: convertTipTapType(k) });
const makeStyledText = (i: Inline, context: JSONContent = {}) => {
  const m = Object.keys(i)[0] as InlineKey;
  if (typeof i === 'string') {
    return {
      ...makeText(i),
      marks: [...(context?.marks || [])],
    };
  }

  return {
    ...makeText(i[m as keyof Inline][0]),
    marks: [{ type: convertTipTapType(m) }, ...(context?.marks || [])],
  };
};

export function wrapParagraphs(content: JSONContent[]) {
  let wrapQueue: JSONContent[] = [];

  const wrappedContent = content.reduce((memo, c) => {
    switch (c.type) {
      case 'paragraph':
        if (wrapQueue.length > 0) {
          memo.push(makeParagraph(wrapQueue));
        }
        memo.push(c);
        wrapQueue = [];
        break;
      case 'blockquote':
        memo.push(c);
        break;
      default:
        wrapQueue.push(c);
        break;
    }

    return memo;
  }, [] as JSONContent[]);

  if (wrapQueue.length > 0) {
    wrappedContent.push(makeParagraph(wrapQueue));
  }

  if (wrappedContent.length === 0) {
    return [makeParagraph([])];
  }

  return wrappedContent;
}

// 'foo' | { bold: ['bar'] } | { italics: [ { bold: [ "foobar" ] } ] } | { 'inline-code': 'code' } | { break: null }
export const inlineToContent = (
  inline: Inline,
  ctx?: JSONContent
): JSONContent => {
  if (typeof inline === 'string') {
    if (ctx && ctx.marks) {
      return makeStyledText(inline, ctx);
    }
    return makeText(inline);
  }

  if ('blockquote' in inline) {
    return {
      type: 'blockquote',
      content: wrapParagraphs(
        inline.blockquote.map((bq) => inlineToContent(bq))
      ),
    };
  }

  if ('break' in inline) {
    return makeParagraph();
  }

  const key = Object.keys(inline)[0] as InlineKey;
  if (key === 'break') {
    return makeParagraph();
  }

  if (key in inline) {
    const inlineValue = inline[key as keyof Inline];
    const newContext: JSONContent = ctx ? Object.assign(ctx) : {};
    newContext.marks = [makeMarks(key), ...(newContext?.marks ?? [])];
    // if Array, it's a nestable tag (bold, italics, strike); otherwise it's
    // an un-nestable tag such as inline-code or code
    return inlineToContent(
      Array.isArray(inlineValue) ? inlineValue[0] : inlineValue,
      newContext
    );
  }

  // TODO: is there a better fallback than an empty newline?
  return makeParagraph();
};

export const blockToContent = (content: DiaryBlock): JSONContent => {
  if ('cite' in content) {
    return {
      type: 'diary-cite',
      attrs: {
        path: citeToPath(content.cite),
      },
    };
  }

  if ('image' in content) {
    return {
      type: 'diary-image',
      attrs: content.image,
    };
  }

  // TODO: is there a better fallback than an empty newline?
  return makeParagraph();
};

/**
 * This function parses Chat, Heap, or Diary Inlines persisted in the backend
 * and re-serializes to the Prosemirror JSONContent schema (which is consumed
 * by the TipTap Editor).
 *
 * @param message An array of Inline items. This is how persisted data is sent
 *   from the backend to the frontend.
 * @returns A JSONContent object (consumed by TipTap Editor to render rich text)
 */
export function inlinesToJSON(message: Inline[]): JSONContent {
  const parsedContent = message.map((m) => inlineToContent(m));

  return {
    type: 'doc',
    content: wrapParagraphs(parsedContent),
  };
}

export function diaryInlinesToJSON(note: NoteContent): JSONContent {
  const parsedContent = note.map((c) => {
    if ('inline' in c) {
      return wrapParagraphs(c.inline.map((i) => inlineToContent(i)));
    }

    return blockToContent(c.block);
  });

  return {
    type: 'doc',
    content: parsedContent.flat(),
  };
}

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: InlineKey): x is typeof MERGEABLE_KEYS[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
export function normalizeInline(inline: Inline[]): Inline[] {
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

const REF_REGEX = /\/1\/(chan|group|desk)\/[^\s]+/g;

export function refPasteRule(onReference: (r: Cite) => void) {
  return new PasteRule({
    find: REF_REGEX,
    handler: ({ state, range, match, chain }) => {
      const cite = pathToCite(match[0] || '');
      if (!cite) {
        // maybe should provide feedback?
        return;
      }

      const insert = '';
      const start = range.from;
      const end = range.to;

      onReference(cite);

      state.tr.insertText(insert, start, end);
      setTimeout(() => console.log(chain().focus().run()), 1);
    },
  });
}
