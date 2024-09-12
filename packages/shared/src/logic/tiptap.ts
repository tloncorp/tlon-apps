import {
  Editor,
  Extension,
  KeyboardShortcutCommand,
  PasteRule,
} from '@tiptap/core';
import { JSONContent } from '@tiptap/react';
import { deSig } from '@urbit/aura';
import { isEqual, reduce } from 'lodash';

import { Block, Cite, HeaderLevel, Listing, Story } from '../urbit/channel';
import {
  Inline,
  InlineKey,
  Link,
  Task,
  isBlockquote,
  isBold,
  isInlineCode,
  isItalics,
  isLink,
  isShip,
  isStrikethrough,
} from '../urbit/content';
import { citeToPath, getFirstInline, pathToCite, preSig } from '../urbit/utils';

export interface HandlerParams {
  editor: Editor;
}

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
    const first = json.marks[0];

    if (!first) {
      throw new Error('Unsure what this is');
    }

    if (first.type === 'link' && first.attrs) {
      return first.attrs.href;
    }

    const jsonWithoutMarks = { ...json };
    delete jsonWithoutMarks.marks;
    return tipTapToString(jsonWithoutMarks);
  }

  return json.text || '';
}

export function inlineToString(inline: Inline): any {
  if (typeof inline === 'string') {
    return inline;
  }

  if (isBold(inline)) {
    return inline.bold.map((i: Inline) => inlineToString(i)).join(' ');
  }

  if (isItalics(inline)) {
    return inline.italics.map((i: Inline) => inlineToString(i));
  }

  if (isStrikethrough(inline)) {
    return inline.strike.map((i: Inline) => inlineToString(i));
  }

  if (isLink(inline)) {
    return inline.link.content;
  }

  if (isBlockquote(inline)) {
    return Array.isArray(inline.blockquote)
      ? inline.blockquote.map((i) => inlineToString(i)).join(' ')
      : inline.blockquote;
  }

  if (isInlineCode(inline)) {
    return typeof inline['inline-code'] === 'object'
      ? inlineToString(inline['inline-code'])
      : inline['inline-code'];
  }

  if (isShip(inline)) {
    return inline.ship;
  }

  return '';
}

export function flattenInline(content: Inline[]): string {
  return content.map((inline) => inlineToString(inline)).join(' ');
}

export function firstInlineSummary(content: Story): string {
  const inlines = getFirstInline(content);
  if (!inlines) {
    return '';
  }

  return flattenInline(inlines);
}

export function inlineSummary(content: Story): string {
  return (content.filter((v) => 'inline' in v) as { inline: Inline[] }[])
    .map((v) => v.inline.map((i) => inlineToString(i)).join(' '))
    .flat()
    .join(' ');
}

// Limits the amount of consecutive breaks to 2 or less
function limitBreaks(
  inlines: (Inline | Block)[],
  maxBreaks = 2
): (Inline | Block)[] {
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
    { count: 0, result: [] as (Inline | Block)[] }
  ).result;
}

const isList = (c: JSONContent) =>
  c.type === 'orderedList' || c.type === 'bulletList' || c.type === 'taskList';

export function JSONToListing(
  json: JSONContent,
  limitNewlines = true
): Listing {
  switch (json.type) {
    case 'orderedList': {
      return {
        list: {
          type: 'ordered',
          items:
            json.content?.map((c) => JSONToListing(c, limitNewlines)) || [],
          contents: [],
        },
      };
    }
    case 'bulletList': {
      return {
        list: {
          type: 'unordered',
          items:
            json.content?.map((c) => JSONToListing(c, limitNewlines)) || [],
          contents: [],
        },
      };
    }
    case 'taskList': {
      return {
        list: {
          type: 'tasklist',
          items:
            json.content?.map((c) => JSONToListing(c, limitNewlines)) || [],
          contents: [],
        },
      };
    }
    case 'listItem': {
      const list = json.content?.find(isList);
      const para = json.content?.find((c) => !isList(c));
      const contents = para
        ? // eslint-disable-next-line @typescript-eslint/no-use-before-define
          (JSONToInlines(para, limitNewlines) as Inline[])
        : [];

      if (list) {
        return {
          list: {
            contents,
            items: list.content
              ? list.content.map((c) => JSONToListing(c, limitNewlines))
              : ([] as Listing[]),
            type: list.type === 'bulletList' ? 'unordered' : 'ordered',
          },
        };
      }

      return {
        item: contents,
      };
    }
    case 'taskItem': {
      const list = json.content?.find(isList);
      const para = json.content?.find((c) => !isList(c));
      const contents = para
        ? // eslint-disable-next-line @typescript-eslint/no-use-before-define
          (JSONToInlines(para, limitNewlines) as Inline[])
        : [];

      if (list) {
        return {
          list: {
            contents,
            items: list.content
              ? list.content.map((c) => JSONToListing(c, limitNewlines))
              : ([] as Listing[]),
            type: 'tasklist',
          },
        };
      }

      return {
        item: [
          {
            task: {
              checked: json.attrs?.checked || false,
              content: contents,
            },
          },
        ],
      };
    }
    default:
      return { item: [''] };
  }
}

export function JSONToInlines(
  json: JSONContent,
  limitNewlines = true,
  codeWithLang = false
): (Inline | Block)[] {
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
          [convertMarkType(first.type)]: JSONToInlines(
            json,
            limitNewlines,
            codeWithLang
          ),
        },
      ] as unknown as (Inline | Block)[];
    }
    case 'paragraph': {
      // newline
      if (!json.content) {
        return [{ break: null }];
      }

      const inlines = json.content.reduce(
        (memo, c, idx) => {
          // this check is here again, for typescript "null" detection
          if (!json.content) {
            return [{ break: null }];
          }
          const isContentFinal = idx === json.content.length - 1;
          const lastMessage = memo[idx - 1];
          const isBreakDirectlyBefore =
            lastMessage &&
            typeof lastMessage !== 'string' &&
            'break' in lastMessage;
          if (isContentFinal && !isBreakDirectlyBefore) {
            return memo.concat(JSONToInlines(c, limitNewlines, codeWithLang), [
              { break: null },
            ]);
          }
          return memo.concat(JSONToInlines(c, limitNewlines, codeWithLang));
        },
        [] as (Inline | Block)[]
      );
      return limitNewlines ? limitBreaks(inlines) : inlines;
    }
    case 'doc': {
      if (!json.content) {
        return [];
      }

      const inlines = json.content.reduce(
        (memo, c) => memo.concat(JSONToInlines(c, limitNewlines, codeWithLang)),
        [] as (Inline | Block)[]
      );
      return limitNewlines ? limitBreaks(inlines) : inlines;
    }
    case 'blockquote': {
      const inlines =
        json.content?.reduce(
          (memo, c) =>
            memo.concat(JSONToInlines(c, limitNewlines, codeWithLang)),
          [] as (Inline | Block)[]
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
        codeWithLang
          ? {
              code: {
                code: json.content[0].text ?? '',
                lang: json.attrs?.language ?? 'plaintext',
              },
            }
          : { code: json.content[0].text ?? '' },
      ];
    }
    case 'orderedList': {
      return [
        {
          listing: JSONToListing(json, limitNewlines),
        },
      ];
    }
    case 'bulletList': {
      return [
        {
          listing: JSONToListing(json, limitNewlines),
        },
      ];
    }
    case 'taskList': {
      return [
        {
          listing: JSONToListing(json, limitNewlines),
        },
      ];
    }
    case 'heading': {
      return [
        {
          header: {
            tag: `h${json.attrs?.level || 2}` as HeaderLevel,
            content: (json.content || []).reduce(
              (memo, c) =>
                memo.concat(JSONToInlines(c, limitNewlines, codeWithLang)),
              [] as (Inline | Block)[]
            ) as Inline[],
          },
        },
      ];
    }
    case 'horizontalRule': {
      return [
        {
          rule: null,
        },
      ];
    }
    case 'mention':
    case 'at-mention': {
      return [
        {
          ship: preSig(json.attrs?.id),
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
const makeLink = (link: Link['link']) => ({
  type: 'text',
  marks: [{ type: 'link', attrs: { href: link.href } }],
  text: link.content,
});
export const makeMention = (ship: string) => ({
  type: 'mention',
  attrs: { id: deSig(ship) },
});
export const makeParagraph = (content?: JSONContent[]): JSONContent => {
  const p = { type: 'paragraph' };
  if (!content) {
    return p;
  }
  if (
    content.length > 0 &&
    content[0].type === 'text' &&
    content[0].text === ''
  ) {
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

  // now that we've wrapped we can remove the empty paragraph objects.
  return wrappedContent.filter(
    (c, i) =>
      (c.content && c.content.length > 0) ||
      (c.content === undefined && wrappedContent[i - 1]?.content === undefined)
  );
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

  if ('task' in inline) {
    return {
      type: 'taskItem',
      attrs: {
        checked: inline.task.checked,
      },
      content: wrapParagraphs(
        inline.task.content.map((i) => inlineToContent(i))
      ),
    };
  }

  if ('break' in inline) {
    return makeParagraph();
  }

  if ('ship' in inline) {
    return makeMention(inline.ship);
  }

  if ('link' in inline) {
    return makeLink(inline.link);
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

export function makeTask(inline: Task): JSONContent {
  return {
    type: 'taskItem',
    attrs: {
      checked: inline.task.checked,
    },
    content: wrapParagraphs(inline.task.content.map((i) => inlineToContent(i))),
  };
}

export function makeListing(listing: Listing): JSONContent {
  if ('list' in listing) {
    const { list } = listing;

    const returnList = {
      type:
        list.type === 'ordered'
          ? 'orderedList'
          : list.type === 'unordered'
            ? 'bulletList'
            : 'taskList',
      content: list.items.map((item) => makeListing(item)),
    };

    if (list.contents.length > 0) {
      const task = list.contents.find(
        (i) => typeof i === 'object' && 'task' in i
      ) as Task | undefined;
      if (task) {
        const item = makeTask(task);

        return {
          ...item,
          content: [...(item.content || []), returnList],
        };
      }

      return {
        type: 'listItem',
        content: [
          ...wrapParagraphs(list.contents.map((i) => inlineToContent(i))),
          returnList,
        ],
      };
    }
    return returnList;
  }

  const task = listing.item.find(
    (i) => typeof i === 'object' && 'task' in i
  ) as Task | undefined;
  return task
    ? makeTask(task)
    : {
        type: 'listItem',
        content: wrapParagraphs(listing.item.map((i) => inlineToContent(i))),
      };
}

export const blockToContent = (content: Block): JSONContent => {
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

  if ('rule' in content) {
    return {
      type: 'horizontalRule',
    };
  }

  if ('listing' in content) {
    return makeListing(content.listing);
  }

  if ('header' in content) {
    const { header } = content;
    const { tag, content: headerContent } = header;

    return {
      type: `heading`,
      attrs: {
        level: parseInt(tag.replace('h', '')),
      },
      content: headerContent.map((i) => inlineToContent(i)),
    };
  }

  if ('code' in content) {
    return {
      type: 'codeBlock',
      content: [
        {
          type: 'text',
          text: content.code.code,
        },
      ],
      attrs: {
        language: content.code.lang || 'plaintext',
      },
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
  const contentIsEmpty = (m: Inline) => isEqual(m, { break: null });

  const parsedContent = message
    // remove empty paragraphs from the end of the message
    .filter((m, i) => !(contentIsEmpty(m) && i === message.length - 1))
    // remove empty paragraphs from the end of blockquotes
    .map((m) => {
      if (typeof m === 'object' && 'blockquote' in m) {
        return {
          blockquote: m.blockquote.filter(
            (bq, i) => !(contentIsEmpty(bq) && i === m.blockquote.length - 1)
          ),
        };
      }
      return m;
    })
    .map((m) => inlineToContent(m));

  return {
    type: 'doc',
    content: wrapParagraphs(parsedContent),
  };
}

export function diaryMixedToJSON(note: Story): JSONContent {
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
function isMergeable(x: InlineKey): x is (typeof MERGEABLE_KEYS)[number] {
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

export const REF_REGEX = /\/1\/(chan|group|desk)\/[^\s]+/g;

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
