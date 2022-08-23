import { Inline, InlineKey } from '@/types/content';
import { reduce } from 'lodash';
import { JSONContent } from '@tiptap/react';
import {Editor, Extension, KeyboardShortcutCommand } from '@tiptap/core';

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
    }
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

// this will be replaced with more sophisticated logic based on
// what we decide will be the message format
export function parseTipTapJSON(json: JSONContent): Inline[] {
  if (json.content) {
    if (json.content.length === 1) {
      if (json.type === 'blockquote') {
        const parsed = parseTipTapJSON(json.content[0]);
        return [
          {
            blockquote: parsed,
          },
        ];
      }
      return parseTipTapJSON(json.content[0]);
    }

    /* Only allow two or less consecutive breaks */
    const breaksAdded: JSONContent[] = [];
    let count = 0;
    json.content.forEach((item) => {
      if (item.type === 'paragraph' && !item.content) {
        if (count === 1) {
          breaksAdded.push(item);
          count += 1;
        }
        return;
      }

      breaksAdded.push(item);

      if (item.type === 'paragraph' && item.content) {
        breaksAdded.push({ type: 'paragraph' });
        count = 1;
      }
    });

    return breaksAdded.reduce(
      (message, contents) => message.concat(parseTipTapJSON(contents)),
      [] as Inline[]
    );
  }

  if (json.marks && json.marks.length > 0) {
    const first = json.marks.pop();

    if (!first) {
      throw new Error('Unsure what this is');
    }

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
        [convertMarkType(first.type)]: parseTipTapJSON(json),
      },
    ] as unknown as Inline[];
  }

  if (json.type === 'paragraph') {
    return [
      {
        break: null,
      },
    ];
  }

  return [json.text || ''];
}

function wrapParagraphs(content: JSONContent[]) {
  let currentContent = content;
  const newContent: JSONContent[] = [];

  let index = currentContent.findIndex((item) => item.type === 'paragraph');
  while (index !== -1) {
    const head = currentContent.slice(0, index);
    const tail = currentContent.slice(index + 1, currentContent.length);

    if (head.length !== 0) {
      newContent.push({
        type: 'paragraph',
        content: head,
      });
    } else {
      newContent.push({
        type: 'paragraph',
      });
    }

    currentContent = tail;
    index = currentContent.findIndex((item) => item.type === 'paragraph');
  }

  if (newContent.length !== 0 && currentContent.length !== 0) {
    newContent.push({
      type: 'paragraph',
      content: currentContent,
    });
  }

  return newContent.length !== 0
    ? newContent
    : [{ type: 'paragraph', content }];
}

/* this parser is still imperfect */
export function parseInline(message: Inline[]): JSONContent {
  const parser = (inline: Inline): JSONContent => {
    if (typeof inline === 'string') {
      return { type: 'text', text: inline };
    }

    if ('blockquote' in inline) {
      return {
        type: 'blockquote',
        content: wrapParagraphs(inline.blockquote.map(parser)),
      };
    }

    const keys = Object.keys(inline);
    const simple = keys.find((k) => ['code', 'tag'].includes(k));
    if (simple) {
      return {
        type: 'text',
        marks: [{ type: convertTipTapType(simple) }],
        text: (inline as any)[simple] || '',
      };
    }

    const recursive = keys.find((k) =>
      ['bold', 'italics', 'strike', 'inline-code'].includes(k)
    );
    if (recursive) {
      const item = (inline as any)[recursive];
      const hasNestedContent = typeof item === 'object';
      const content = hasNestedContent ? parser(item) : item;

      if (hasNestedContent) {
        const marks = content.marks ? content.marks : [];

        return {
          type: 'text',
          marks: marks.concat([{ type: convertTipTapType(recursive) }]),
          text: content.text || 'foo',
        };
      }

      return {
        type: 'text',
        marks: [{ type: convertTipTapType(recursive) }],
        text: content,
      };
    }

    return { type: 'paragraph' };
  };

  if (message.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const content = wrapParagraphs(message.map(parser));
  return {
    type: 'doc',
    content,
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
