import type * as cn from '@tloncorp/shared/logic';

import { highlightCodeRuns } from '../HighlightedCode';
import { listItemMarkerType } from '../PostContent/BlockRenderer';

// A note's rendered content as plain data for the native preview views, which
// draw it as one selectable document. Built from the same PostContent the
// React renderer draws, so both show the same formatting.

export type NoteDocumentRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  // Pressing it opens this URL.
  link?: string;
  // Pressing it opens this contact's profile.
  mention?: string;
  // A highlighted code token's own colour, or a mention without a contact.
  color?: string;
  tint?: 'mention' | 'tertiary';
};

export type NoteDocumentTextStyle =
  | 'body'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'bigEmoji';

export type NoteDocumentBlock =
  | {
      type: 'text';
      style: NoteDocumentTextStyle;
      runs: NoteDocumentRun[];
      // List nesting: each level indents one step, and `marker` ("1.", "•")
      // hangs in front of the first line. `listStart` marks a list's first
      // item, so two lists in a row are spaced as separate blocks.
      indent?: number;
      marker?: string;
      listStart?: boolean;
    }
  | { type: 'code'; runs: NoteDocumentRun[] }
  | {
      type: 'image';
      src: string;
      width: number;
      height: number;
      alt: string;
    }
  | {
      type: 'video';
      src: string;
      posterUri?: string;
      width?: number;
      height?: number;
    }
  | {
      type: 'table';
      header: NoteDocumentRun[][];
      rows: NoteDocumentRun[][][];
      align: (cn.TableAlignment | null)[];
    }
  | { type: 'rule' };

type RunStyle = Omit<NoteDocumentRun, 'text'>;

export function buildNoteDocument(
  content: cn.PostContent,
  contactName: (contactId: string) => string
): NoteDocumentBlock[] {
  const toRuns = (inlines: cn.InlineData[], style: RunStyle = {}) =>
    inlineRuns(inlines, style, contactName);
  const blocks: NoteDocumentBlock[] = [];
  for (const block of content) {
    switch (block.type) {
      case 'paragraph':
        blocks.push({
          type: 'text',
          style: 'body',
          runs: toRuns(block.content),
        });
        break;
      case 'header':
        blocks.push({
          type: 'text',
          style: block.level,
          runs: toRuns(block.children),
        });
        break;
      case 'blockquote':
        blocks.push({
          type: 'text',
          style: 'quote',
          runs: toRuns(block.content, { tint: 'tertiary' }),
        });
        break;
      case 'bigEmoji':
        blocks.push({
          type: 'text',
          style: 'bigEmoji',
          runs: [{ text: block.emoji }],
        });
        break;
      case 'list':
        pushListItems(blocks, block.list, 0, toRuns, true);
        break;
      case 'code':
        blocks.push({
          type: 'code',
          runs: highlightCodeRuns(block.content, block.lang),
        });
        break;
      case 'image':
        blocks.push({
          type: 'image',
          src: block.src,
          width: block.width,
          height: block.height,
          alt: block.alt,
        });
        break;
      case 'video':
        blocks.push({
          type: 'video',
          src: block.video.src,
          posterUri: block.video.posterUri,
          width: block.video.width,
          height: block.video.height,
        });
        break;
      case 'table':
        blocks.push({
          type: 'table',
          header: block.header.cells.map((cell) => toRuns(cell.content)),
          rows: block.rows.map((row) =>
            row.cells.map((cell) => toRuns(cell.content))
          ),
          align: block.align,
        });
        break;
      case 'rule':
        blocks.push({ type: 'rule' });
        break;
      default:
        // Markdown can't produce the remaining block types (references,
        // files, cards); a note body never contains them.
        break;
    }
  }
  return blocks;
}

function pushListItems(
  blocks: NoteDocumentBlock[],
  list: cn.ListData,
  depth: number,
  toRuns: (inlines: cn.InlineData[]) => NoteDocumentRun[],
  startsList = false
) {
  list.children?.forEach((item, index) => {
    const markerType = listItemMarkerType(list.type ?? 'unordered', item);
    blocks.push({
      type: 'text',
      style: 'body',
      runs: toRuns(item.content),
      indent: depth,
      // A task's checkbox is part of its text, as in the React renderer.
      marker:
        markerType === 'ordered'
          ? `${index + 1}.`
          : markerType === 'unordered'
            ? '•'
            : undefined,
      ...(startsList && index === 0 ? { listStart: true } : {}),
    });
    if (item.children?.length) {
      pushListItems(blocks, item, depth + 1, toRuns);
    }
  });
}

function inlineRuns(
  inlines: cn.InlineData[],
  style: RunStyle,
  contactName: (contactId: string) => string
): NoteDocumentRun[] {
  const runs: NoteDocumentRun[] = [];
  const push = (text: string, extra: RunStyle = {}) => {
    if (text) runs.push({ text, ...style, ...extra });
  };
  for (const inline of inlines) {
    switch (inline.type) {
      case 'text':
        push(inline.text);
        break;
      case 'style':
        runs.push(
          ...inlineRuns(
            inline.children,
            { ...style, [inline.style]: true },
            contactName
          )
        );
        break;
      case 'link':
        push(inline.text || inline.href, { link: inline.href });
        break;
      case 'mention':
        push(contactName(inline.contactId), {
          mention: inline.contactId,
          tint: 'mention',
        });
        break;
      case 'groupMention':
        push(`@${inline.group}`, { tint: 'mention' });
        break;
      case 'lineBreak':
        // The notebook renderer draws a line break as a paragraph gap.
        push('\n\n');
        break;
      case 'task':
        push(inline.checked ? '☑ ' : '☐ ');
        runs.push(...inlineRuns(inline.children, style, contactName));
        break;
      case 'blockquote':
        push(' > ', { tint: 'tertiary' });
        runs.push(
          ...inlineRuns(
            inline.children,
            { ...style, tint: 'tertiary' },
            contactName
          )
        );
        break;
    }
  }
  return runs;
}
