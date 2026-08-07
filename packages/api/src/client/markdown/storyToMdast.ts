import type {
  Delete,
  Emphasis,
  Heading,
  Blockquote as MdastBlockquote,
  Code as MdastCode,
  Image as MdastImage,
  InlineCode as MdastInlineCode,
  Link as MdastLink,
  List as MdastList,
  ListItem as MdastListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Strong,
  Text,
  ThematicBreak,
} from 'mdast';

import { Story, Verse, isBlockVerse } from '../../urbit/channel';
import {
  Block,
  BlockReference,
  Blockquote,
  Bold,
  Break,
  Code,
  Header,
  Image,
  Inline,
  InlineCode,
  Italics,
  Link,
  List,
  ListItem,
  Listing,
  ListingBlock,
  Rule,
  Sect,
  Ship,
  Strikethrough,
  Tag,
  Task,
  isBlockCode,
  isBlockReference,
  isBlockquote,
  isBold,
  isBreak,
  isCode,
  isHeader,
  isImage,
  isInlineCode,
  isItalics,
  isLink,
  isList,
  isListItem,
  isListing,
  isSect,
  isShip,
  isStrikethrough,
  isTag,
  isTask,
} from '../../urbit/content';
import {
  SHIP_MENTION_FUSABLE_START,
  type ShipMention,
} from './shipMentionPlugin';

export interface StoryToMdastOptions {
  strict?: boolean;
}

/**
 * Backend block variants that Markdown conversion intentionally does not
 * support. Callers count these variants and disclose their removal before
 * conversion, so strict mode accepts and deliberately drops them.
 */
export const KNOWN_DELIBERATELY_UNSUPPORTED_BLOCK_VARIANTS: ReadonlySet<
  'cite' | 'link'
> = new Set(['cite', 'link']);

function isKnownDeliberatelyUnsupportedBlock(block: Block): boolean {
  return [...KNOWN_DELIBERATELY_UNSUPPORTED_BLOCK_VARIANTS].some(
    (variant) => variant in block
  );
}

function codeLanguage(lang: string): string | undefined {
  return lang || undefined;
}

/**
 * Check if a block is a Rule (horizontal rule).
 */
function isRule(block: Block): block is Rule {
  return 'rule' in block;
}

/**
 * Merge adjacent inline elements of the same type (italics, bold, strike).
 * This handles cases where Tiptap splits styled content into multiple segments.
 */
function mergeAdjacentMarks(inlines: Inline[]): Inline[] {
  if (inlines.length === 0) return inlines;

  const result: Inline[] = [];

  for (const inline of inlines) {
    const last = result[result.length - 1];

    // Check if we can merge with the previous element
    if (last && typeof last === 'object' && typeof inline === 'object') {
      // Check for italics merge
      if (isItalics(last) && isItalics(inline)) {
        const lastItalics = last as Italics;
        const currentItalics = inline as Italics;
        result[result.length - 1] = {
          italics: [...lastItalics.italics, ...currentItalics.italics],
        };
        continue;
      }

      // Check for bold merge
      if (isBold(last) && isBold(inline)) {
        const lastBold = last as Bold;
        const currentBold = inline as Bold;
        result[result.length - 1] = {
          bold: [...lastBold.bold, ...currentBold.bold],
        };
        continue;
      }

      // Check for strikethrough merge
      if (isStrikethrough(last) && isStrikethrough(inline)) {
        const lastStrike = last as Strikethrough;
        const currentStrike = inline as Strikethrough;
        result[result.length - 1] = {
          strike: [...lastStrike.strike, ...currentStrike.strike],
        };
        continue;
      }
    }

    result.push(inline);
  }

  return result;
}

type PhrasingMark = 'strong' | 'emphasis' | 'delete';

function wrapWithMark(
  children: PhrasingContent[],
  mark: PhrasingMark
): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  let marked: PhrasingContent[] = [];
  const flushMarked = () => {
    if (marked.length > 0) {
      result.push({ type: mark, children: marked } as
        | Strong
        | Emphasis
        | Delete);
      marked = [];
    }
  };

  for (const child of children) {
    if (child.type === 'break') {
      flushMarked();
      result.push(child);
    } else if (child.type === mark && isPhrasingMark(child)) {
      marked.push(...child.children);
    } else {
      marked.push(child);
    }
  }
  flushMarked();
  return result;
}

/**
 * Convert Story Inline array to mdast phrasing content.
 */
export function inlinesToPhrasing(
  inlines: Inline[],
  opts?: StoryToMdastOptions,
  placement = 'phrasing context'
): PhrasingContent[] {
  const merged = mergeAdjacentMarks(inlines);

  // Filter out trailing breaks - they mark paragraph boundaries, not hard line breaks
  let filtered = merged;
  while (filtered.length > 0 && isBreak(filtered[filtered.length - 1])) {
    filtered = filtered.slice(0, -1);
  }

  const result: PhrasingContent[] = [];

  for (const inline of filtered) {
    if (typeof inline === 'string') {
      const text: Text = { type: 'text', value: inline };
      result.push(text);
      continue;
    }

    if (isBold(inline)) {
      const bold = inline as Bold;
      result.push(
        ...wrapWithMark(
          inlinesToPhrasing(bold.bold, opts, `${placement} under bold`),
          'strong'
        )
      );
      continue;
    }

    if (isItalics(inline)) {
      const italics = inline as Italics;
      result.push(
        ...wrapWithMark(
          inlinesToPhrasing(
            italics.italics,
            opts,
            `${placement} under italics`
          ),
          'emphasis'
        )
      );
      continue;
    }

    if (isStrikethrough(inline)) {
      const strike = inline as Strikethrough;
      result.push(
        ...wrapWithMark(
          inlinesToPhrasing(
            strike.strike,
            opts,
            `${placement} under strikethrough`
          ),
          'delete'
        )
      );
      continue;
    }

    if (isInlineCode(inline)) {
      const code = inline as InlineCode;
      const inlineCode: MdastInlineCode = {
        type: 'inlineCode',
        value: code['inline-code'],
      };
      result.push(inlineCode);
      continue;
    }

    if (isLink(inline)) {
      const link = inline as Link;
      const mdastLink: MdastLink = {
        type: 'link',
        url: link.link.href,
        children: [{ type: 'text', value: link.link.content }],
      };
      result.push(mdastLink);
      continue;
    }

    if (isShip(inline)) {
      const ship = inline as Ship;
      // Use our custom ship mention node; its value carries exactly one
      // leading sigil, matching the tokenizer's matched-source contract.
      const shipMention: ShipMention = {
        type: 'shipMention',
        value: `~${ship.ship.replace(/^~+/, '')}`,
      };
      result.push(shipMention as unknown as PhrasingContent);
      continue;
    }

    if (isSect(inline)) {
      const sect = inline as Sect;
      const value =
        sect.sect === null || sect.sect === '' ? '@all' : `@${sect.sect}`;
      result.push({ type: 'text', value });
      continue;
    }

    if (isTag(inline)) {
      const tag = inline as Tag;
      result.push({ type: 'text', value: tag.tag });
      continue;
    }

    if (isBlockReference(inline)) {
      const blockRef = inline as BlockReference;
      result.push({ type: 'text', value: blockRef.block.text });
      continue;
    }

    if (isBreak(inline)) {
      result.push({ type: 'break' });
      continue;
    }

    if (isTask(inline)) {
      // Task inlines are rendered as checkbox text using html to prevent escaping
      const task = inline as Task;
      const checkbox = task.task.checked ? '[x]' : '[ ]';
      const content = inlinesToPhrasing(
        task.task.content,
        opts,
        `${placement} under task`
      );
      result.push({
        type: 'html',
        value: `${checkbox} `,
      } as unknown as PhrasingContent);
      result.push(...content);
      continue;
    }

    if (isBlockquote(inline)) {
      if (opts?.strict) {
        throw new Error(
          `Cannot render blockquote faithfully in ${placement} in strict mode`
        );
      }
      // Blockquote in inline context - render as HTML to prevent escaping
      // We need to preserve formatting, so we serialize the content to markdown first
      const bq = inline as Blockquote;
      const content = inlinesToPhrasing(
        bq.blockquote,
        opts,
        `${placement} under blockquote`
      );
      const text = phrasingToMarkdown(content);
      const lines = text.split('\n');
      let value = lines.map((line) => `> ${line}`).join('\n');
      // The assembled bridge string becomes one html node whose outer
      // siblings the serialize-path separators cannot protect; end it with
      // punctuation so nothing can fuse with or encode its trailing edge.
      if (/[A-Za-z0-9]$/.test(value)) {
        value += '<!-- -->';
      }
      result.push({
        type: 'html',
        value,
      } as unknown as PhrasingContent);
      continue;
    }

    // Handle block code in inline context (from JSONToInlines with codeWithLang=false)
    if (isBlockCode(inline)) {
      if (opts?.strict) {
        throw new Error(
          `Cannot render code block faithfully in ${placement} in strict mode`
        );
      }
      const codeContent = (inline as { code: string }).code;
      result.push({
        type: 'text',
        value: `\`\`\`\n${codeContent}\n\`\`\``,
        // Marks this piece as bridge-rendered code so the bridge's prose
        // escaping skips it; final-tree serialization ignores `data`.
        data: { bridgeCode: true },
      } as unknown as PhrasingContent);
      continue;
    }

    // Handle Code block in inline context
    if (isCode(inline as unknown as Block)) {
      if (opts?.strict) {
        throw new Error(
          `Cannot render code block faithfully in ${placement} in strict mode`
        );
      }
      const code = inline as unknown as Code;
      const lang = code.code.lang || '';
      result.push({
        type: 'text',
        value: `\`\`\`${lang}\n${code.code.code}\n\`\`\``,
        data: { bridgeCode: true },
      } as unknown as PhrasingContent);
      continue;
    }

    // Handle Image in inline context
    if (isImage(inline as unknown as Block)) {
      const image = inline as unknown as Image;
      const mdastImage: MdastImage = {
        type: 'image',
        url: image.image.src,
        alt: image.image.alt || undefined,
      };
      result.push(mdastImage);
      continue;
    }

    if (opts?.strict) {
      const description =
        typeof inline === 'object' && inline !== null
          ? `{ ${Object.keys(inline).join(', ')} }`
          : String(inline);
      throw new Error(`Unknown inline variant in strict mode: ${description}`);
    }
  }

  return result;
}

/**
 * Convert phrasing content to plain text (for simple cases).
 */
function phrasingToText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return (node as Text).value;
      if (node.type === 'break') return '\n';
      if ('children' in node) {
        return phrasingToText(node.children as PhrasingContent[]);
      }
      return '';
    })
    .join('');
}

/**
 * Convert phrasing content to a markdown string (preserves formatting).
 * The result is emitted verbatim inside an html node, outside
 * remark-stringify's escaping and encode machinery, so the bridge escapes
 * prose text itself (backslash first, then tilde) and inserts a
 * content-neutral separator where a rendered mention would fuse with the
 * following piece.
 */
function phrasingToMarkdown(nodes: PhrasingContent[]): string {
  let result = '';
  let previousIsMention = false;

  for (const node of nodes) {
    const piece = phrasingPieceToMarkdown(node);
    // Zero-width pieces do not affect adjacency.
    if (piece === '') continue;
    if (previousIsMention && SHIP_MENTION_FUSABLE_START.test(piece)) {
      result += '<!-- -->';
    }
    result += piece;
    previousIsMention = (node as { type: string }).type === 'shipMention';
  }

  return result;
}

function phrasingPieceToMarkdown(node: PhrasingContent): string {
  switch ((node as { type: string }).type) {
    case 'text': {
      const value = (node as Text).value;
      // Bridge-rendered code fences are tagged at construction; inside a
      // fence a backslash is data, so those pass through unchanged. All
      // other text is prose — even if it happens to start with backticks —
      // and must be escaped so ship-shaped tokens stay literal.
      if ((node as { data?: { bridgeCode?: boolean } }).data?.bridgeCode) {
        return value;
      }
      return value.replace(/\\/g, '\\\\').replace(/~/g, '\\~');
    }
    case 'strong': {
      const inner = phrasingToMarkdown((node as Strong).children);
      return `**${inner}**`;
    }
    case 'emphasis': {
      const inner = phrasingToMarkdown((node as Emphasis).children);
      return `*${inner}*`;
    }
    case 'delete': {
      const inner = phrasingToMarkdown((node as Delete).children);
      return `~~${inner}~~`;
    }
    case 'inlineCode':
      return `\`${(node as MdastInlineCode).value}\``;
    case 'link': {
      const link = node as MdastLink;
      const content = phrasingToMarkdown(link.children);
      return `[${content}](${link.url})`;
    }
    case 'break':
      return '\n';
    case 'html':
      return (node as { value: string }).value;
    case 'shipMention':
      return (node as unknown as ShipMention).value;
    default:
      if ('children' in node) {
        return phrasingToMarkdown(
          (node as { children: PhrasingContent[] }).children
        );
      }
      return '';
  }
}

function wrapPhrasing(
  children: PhrasingContent[],
  marks: PhrasingMark[]
): PhrasingContent[] {
  let wrapped = children;
  const uniqueMarks = marks.filter(
    (mark, index) => marks.indexOf(mark) === index
  );
  for (let index = uniqueMarks.length - 1; index >= 0; index -= 1) {
    wrapped = wrapWithMark(wrapped, uniqueMarks[index]);
  }
  return wrapped;
}

function isPhrasingMark(
  node: PhrasingContent
): node is Strong | Emphasis | Delete {
  return (
    node.type === 'strong' || node.type === 'emphasis' || node.type === 'delete'
  );
}

function appendPhrasing(
  target: PhrasingContent[],
  nodes: PhrasingContent[]
): void {
  for (const node of nodes) {
    const last = target[target.length - 1];
    if (last && isPhrasingMark(last) && last.type === node.type) {
      appendPhrasing(
        last.children,
        (node as Strong | Emphasis | Delete).children
      );
    } else {
      target.push(node);
    }
  }
}

function trimTrailingBreaks(nodes: PhrasingContent[]): void {
  while (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    if (last.type === 'break') {
      nodes.pop();
      continue;
    }
    if (
      last.type === 'strong' ||
      last.type === 'emphasis' ||
      last.type === 'delete'
    ) {
      trimTrailingBreaks(last.children);
      if (last.children.length === 0) {
        nodes.pop();
        continue;
      }
    }
    break;
  }
}

function containsBlockInline(inlines: Inline[]): boolean {
  return inlines.some((inline) => {
    if (typeof inline === 'string') return false;
    if (
      isBlockquote(inline) ||
      isBlockCode(inline) ||
      isCode(inline as unknown as Block)
    ) {
      return true;
    }
    if (isBold(inline)) {
      return containsBlockInline((inline as Bold).bold);
    }
    if (isItalics(inline)) {
      return containsBlockInline((inline as Italics).italics);
    }
    if (isStrikethrough(inline)) {
      return containsBlockInline((inline as Strikethrough).strike);
    }
    if (isTask(inline)) {
      return containsBlockInline((inline as Task).task.content);
    }
    return false;
  });
}

/**
 * Convert an inline list in a block-capable position. Legal inline blockquotes
 * and `%code` values are lifted to mdast blocks, while surrounding phrasing is
 * flushed into paragraphs.
 */
export function inlinesToMdast(
  inlines: Inline[],
  opts?: StoryToMdastOptions,
  placement = 'inline verse',
  marks: PhrasingMark[] = []
): RootContent[] {
  const merged = mergeAdjacentMarks(inlines);
  let filtered = merged;
  while (filtered.length > 0 && isBreak(filtered[filtered.length - 1])) {
    filtered = filtered.slice(0, -1);
  }

  const result: RootContent[] = [];
  let phrasing: PhrasingContent[] = [];

  const flushPhrasing = () => {
    trimTrailingBreaks(phrasing);
    while (phrasing[0]?.type === 'break') {
      phrasing.shift();
    }
    if (phrasing.length > 0) {
      result.push({ type: 'paragraph', children: phrasing });
      phrasing = [];
    }
  };

  const flushPhrasingBeforeBlock = () => {
    trimTrailingBreaks(phrasing);
    flushPhrasing();
  };

  for (const inline of filtered) {
    if (typeof inline === 'string') {
      appendPhrasing(
        phrasing,
        wrapPhrasing([{ type: 'text', value: inline }], marks)
      );
      continue;
    }

    if (isBold(inline)) {
      const bold = inline as Bold;
      const nestedMarks: PhrasingMark[] = [...marks, 'strong'];
      if (containsBlockInline(bold.bold)) {
        flushPhrasingBeforeBlock();
        result.push(
          ...inlinesToMdast(
            bold.bold,
            opts,
            `${placement} under bold`,
            nestedMarks
          )
        );
      } else {
        appendPhrasing(
          phrasing,
          wrapPhrasing(
            inlinesToPhrasing(bold.bold, opts, `${placement} under bold`),
            nestedMarks
          )
        );
      }
      continue;
    }

    if (isItalics(inline)) {
      const italics = inline as Italics;
      const nestedMarks: PhrasingMark[] = [...marks, 'emphasis'];
      if (containsBlockInline(italics.italics)) {
        flushPhrasingBeforeBlock();
        result.push(
          ...inlinesToMdast(
            italics.italics,
            opts,
            `${placement} under italics`,
            nestedMarks
          )
        );
      } else {
        appendPhrasing(
          phrasing,
          wrapPhrasing(
            inlinesToPhrasing(
              italics.italics,
              opts,
              `${placement} under italics`
            ),
            nestedMarks
          )
        );
      }
      continue;
    }

    if (isStrikethrough(inline)) {
      const strike = inline as Strikethrough;
      const nestedMarks: PhrasingMark[] = [...marks, 'delete'];
      if (containsBlockInline(strike.strike)) {
        flushPhrasingBeforeBlock();
        result.push(
          ...inlinesToMdast(
            strike.strike,
            opts,
            `${placement} under strikethrough`,
            nestedMarks
          )
        );
      } else {
        appendPhrasing(
          phrasing,
          wrapPhrasing(
            inlinesToPhrasing(
              strike.strike,
              opts,
              `${placement} under strikethrough`
            ),
            nestedMarks
          )
        );
      }
      continue;
    }

    if (isBlockquote(inline)) {
      flushPhrasingBeforeBlock();
      const blockquote = inline as Blockquote;
      const children = inlinesToMdast(
        blockquote.blockquote,
        opts,
        `${placement} under blockquote`,
        marks
      );
      result.push({
        type: 'blockquote',
        children: children as MdastBlockquote['children'],
      });
      continue;
    }

    if (isBlockCode(inline)) {
      flushPhrasingBeforeBlock();
      if (marks.length > 0 && opts?.strict) {
        throw new Error(
          `Cannot render code block faithfully in ${placement} in strict mode`
        );
      }
      result.push({
        type: 'code',
        lang:
          !opts?.strict &&
          (placement.startsWith('inline verse') ||
            placement.startsWith('root list contents'))
            ? 'text'
            : undefined,
        value: (inline as { code: string }).code,
      });
      continue;
    }

    if (isCode(inline as unknown as Block)) {
      flushPhrasingBeforeBlock();
      if (marks.length > 0 && opts?.strict) {
        throw new Error(
          `Cannot render code block faithfully in ${placement} in strict mode`
        );
      }
      const code = inline as unknown as Code;
      result.push({
        type: 'code',
        lang: codeLanguage(code.code.lang),
        value: code.code.code,
      });
      continue;
    }

    if (isTask(inline) && containsBlockInline((inline as Task).task.content)) {
      if (opts?.strict) {
        throw new Error(
          `Cannot render block content faithfully in task outside a task-list item in ${placement} in strict mode`
        );
      }
    }

    if (isBreak(inline)) {
      phrasing.push({ type: 'break' });
      continue;
    }

    appendPhrasing(
      phrasing,
      wrapPhrasing(inlinesToPhrasing([inline], opts, placement), marks)
    );
  }

  flushPhrasing();
  return result;
}

function liftBreaksThroughMarks(inlines: Inline[]): Inline[] {
  const result: Inline[] = [];

  for (const inline of inlines) {
    let children: Inline[] | undefined;
    let wrap: ((segment: Inline[]) => Inline) | undefined;
    if (typeof inline !== 'string' && isBold(inline)) {
      children = (inline as Bold).bold;
      wrap = (segment) => ({ bold: segment });
    } else if (typeof inline !== 'string' && isItalics(inline)) {
      children = (inline as Italics).italics;
      wrap = (segment) => ({ italics: segment });
    } else if (typeof inline !== 'string' && isStrikethrough(inline)) {
      children = (inline as Strikethrough).strike;
      wrap = (segment) => ({ strike: segment });
    }

    if (!children || !wrap) {
      result.push(inline);
      continue;
    }

    let segment: Inline[] = [];
    const flushSegment = () => {
      if (segment.length > 0) {
        result.push(wrap(segment));
        segment = [];
      }
    };
    for (const child of liftBreaksThroughMarks(children)) {
      if (isBreak(child)) {
        flushSegment();
        result.push(child);
      } else {
        segment.push(child);
      }
    }
    flushSegment();
  }

  return result;
}

function listItemInlinesToMdast(
  inlines: Inline[],
  opts?: StoryToMdastOptions,
  placement = 'list item'
): RootContent[] {
  const paragraphs: Inline[][] = [];
  let currentParagraph: Inline[] = [];

  for (const inline of liftBreaksThroughMarks(inlines)) {
    if (isBreak(inline)) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
    } else {
      currentParagraph.push(inline);
    }
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  return paragraphs.flatMap((paragraph) =>
    inlinesToMdast(paragraph, opts, placement)
  );
}

/**
 * A paragraph immediately following a blockquote needs a blank line inside a
 * list item. Without it, CommonMark parses the paragraph as a lazy continuation
 * of the quote and moves it into the blockquote.
 */
function preserveBlockquoteOwnership(item: MdastListItem): MdastListItem {
  if (
    item.children.some(
      (child, index) =>
        child.type === 'blockquote' &&
        item.children[index + 1]?.type === 'paragraph'
    )
  ) {
    item.spread = true;
  }
  return item;
}

function rendersVisibleContent(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) {
    return false;
  }
  const candidate = node as { value?: unknown; children?: unknown };
  if (typeof candidate.value === 'string') {
    return candidate.value.length > 0;
  }
  if (Array.isArray(candidate.children)) {
    return candidate.children.some((child) => rendersVisibleContent(child));
  }
  return true;
}

/**
 * remark-gfm only emits a task marker when a list item's first child is a
 * paragraph that serializes to something. A paragraph that renders to nothing
 * disappears, so block-first and empty tasks need an invisible comment to
 * anchor the marker. The Markdown parser ignores that comment when converting
 * the item back to Story.
 */
function ensureTaskMarkerParagraph(
  children: RootContent[]
): MdastListItem['children'] {
  if (children[0]?.type === 'paragraph' && rendersVisibleContent(children[0])) {
    return children as MdastListItem['children'];
  }

  const markerParagraph: Paragraph = {
    type: 'paragraph',
    children: [{ type: 'html', value: '<!-- -->' }],
  };
  return [markerParagraph, ...(children as MdastListItem['children'])];
}

function countTasks(inlines: Inline[]): number {
  return inlines.reduce((count, inline) => {
    if (typeof inline === 'string') {
      return count;
    }
    if (isTask(inline)) {
      return count + 1 + countTasks((inline as Task).task.content);
    }
    if (isBold(inline)) {
      return count + countTasks((inline as Bold).bold);
    }
    if (isItalics(inline)) {
      return count + countTasks((inline as Italics).italics);
    }
    if (isStrikethrough(inline)) {
      return count + countTasks((inline as Strikethrough).strike);
    }
    if (isBlockquote(inline)) {
      return count + countTasks((inline as Blockquote).blockquote);
    }
    return count;
  }, 0);
}

function rejectUnrepresentableTaskPlacement(
  inlines: Inline[],
  opts: StoryToMdastOptions | undefined,
  placement: string
): void {
  if (!opts?.strict) {
    return;
  }

  const taskCount = countTasks(inlines);

  if (taskCount > 1) {
    throw new Error(
      `Cannot render more than one task in ${placement} faithfully in strict mode`
    );
  }
  if (taskCount === 1 && !isTask(inlines[0])) {
    throw new Error(
      `Cannot render a task that is not the first inline in ${placement} faithfully in strict mode`
    );
  }
}

/**
 * Convert Story Listing to mdast ListItem array.
 */
function listingsToListItems(
  listings: Listing[],
  listType: 'ordered' | 'unordered' | 'tasklist',
  opts?: StoryToMdastOptions
): MdastListItem[] {
  const items: MdastListItem[] = [];

  for (const listing of listings) {
    if (isListItem(listing)) {
      const listItem = listing as ListItem;

      if (listType === 'tasklist') {
        rejectUnrepresentableTaskPlacement(
          listItem.item,
          opts,
          'task-list item'
        );
      }

      // Check if this is a task list item
      if (
        listType === 'tasklist' &&
        listItem.item.length > 0 &&
        isTask(listItem.item[0])
      ) {
        const task = listItem.item[0] as Task;
        const taskContent = listItemInlinesToMdast(
          [...task.task.content, ...listItem.item.slice(1)],
          opts,
          'task-list item'
        );
        const mdastItem: MdastListItem = preserveBlockquoteOwnership({
          type: 'listItem',
          checked: task.task.checked,
          children: ensureTaskMarkerParagraph(taskContent),
        });
        items.push(mdastItem);
      } else {
        const content = listItemInlinesToMdast(
          listItem.item,
          opts
        ) as MdastListItem['children'];
        const mdastItem: MdastListItem = preserveBlockquoteOwnership({
          type: 'listItem',
          children: content,
        });
        items.push(mdastItem);
      }
    } else if (isList(listing)) {
      const list = listing as List;
      // `contents` is the inline content of this item in the *outer* list, so
      // whether it may hold a task is decided by `listType`. `list.list.type`
      // describes the nested child list built from `items`.
      if (listType === 'tasklist') {
        rejectUnrepresentableTaskPlacement(
          list.list.contents,
          opts,
          'nested task-list item'
        );
      } else if (opts?.strict && countTasks(list.list.contents) > 0) {
        throw new Error(
          'Cannot render a task in the contents of a non-task list item faithfully in strict mode'
        );
      }

      const nestedList: MdastList = {
        type: 'list',
        ordered: list.list.type === 'ordered',
        children: listingsToListItems(list.list.items, list.list.type, opts),
      };

      if (
        listType === 'tasklist' &&
        list.list.contents.length > 0 &&
        isTask(list.list.contents[0])
      ) {
        const task = list.list.contents[0] as Task;
        const taskContent = listItemInlinesToMdast(
          [...task.task.content, ...list.list.contents.slice(1)],
          opts,
          'nested task-list contents'
        );
        const mdastItem: MdastListItem = preserveBlockquoteOwnership({
          type: 'listItem',
          checked: task.task.checked,
          children: [...ensureTaskMarkerParagraph(taskContent), nestedList],
        });
        items.push(mdastItem);
      } else {
        // Only reached when the contents are not a task, so converting them
        // here cannot trip the strict-mode guard on tasks carrying blocks.
        const contentChildren = listItemInlinesToMdast(
          list.list.contents,
          opts,
          'nested list contents'
        );
        const mdastItem: MdastListItem = preserveBlockquoteOwnership({
          type: 'listItem',
          children:
            contentChildren.length > 0
              ? [...(contentChildren as MdastListItem['children']), nestedList]
              : [nestedList],
        });
        items.push(mdastItem);
      }
    }
  }

  return items;
}

/**
 * Convert a Story Block to mdast RootContent.
 */
function blockToMdast(block: Block, opts?: StoryToMdastOptions): RootContent[] {
  if (isHeader(block)) {
    const header = block as Header;
    const depth = parseInt(header.header.tag.charAt(1), 10) as
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6;
    const children = inlinesToPhrasing(header.header.content, opts, 'header');
    const heading: Heading = { type: 'heading', depth, children };
    return [heading];
  }

  if (isCode(block)) {
    const code = block as Code;
    const mdastCode: MdastCode = {
      type: 'code',
      lang: codeLanguage(code.code.lang),
      value: code.code.code,
    };
    return [mdastCode];
  }

  if (isImage(block)) {
    const image = block as Image;
    // Wrap image in paragraph for standalone images
    const mdastImage: MdastImage = {
      type: 'image',
      url: image.image.src,
      alt: image.image.alt || undefined,
    };
    const paragraph: Paragraph = { type: 'paragraph', children: [mdastImage] };
    return [paragraph];
  }

  if (isRule(block)) {
    const thematicBreak: ThematicBreak = { type: 'thematicBreak' };
    return [thematicBreak];
  }

  if (isListing(block)) {
    const listingBlock = block as ListingBlock;
    const listing = listingBlock.listing;

    if (isList(listing)) {
      const list = listing as List;
      const mdastList: MdastList = {
        type: 'list',
        ordered: list.list.type === 'ordered',
        children: listingsToListItems(list.list.items, list.list.type, opts),
      };
      const rootContents = inlinesToMdast(
        list.list.contents,
        opts,
        'root list contents'
      );
      return [...rootContents, mdastList];
    } else if (isListItem(listing)) {
      // Single list item - wrap in list
      const mdastList: MdastList = {
        type: 'list',
        ordered: false,
        children: listingsToListItems([listing], 'unordered', opts),
      };
      return [mdastList];
    }
  }

  if (isKnownDeliberatelyUnsupportedBlock(block)) {
    // These are counted and disclosed by callers before conversion. Keep the
    // drop explicit: `%cite` and block `%link` are unsupported, not unknown.
    return [];
  }

  // Unknown variants are rejected by strict validation and skipped otherwise.
  return [];
}

/**
 * Convert a Story VerseInline to mdast content.
 * Returns an array because blockquotes in inline content need to be split into separate blocks.
 */
function verseInlineToMdast(
  inline: Inline[],
  opts?: StoryToMdastOptions
): RootContent[] {
  return inlinesToMdast(inline, opts);
}

function validateInlinesStrict(inlines: Inline[]): void {
  for (const inline of inlines) {
    if (typeof inline === 'string') continue;
    if (isBold(inline)) {
      validateInlinesStrict((inline as Bold).bold);
      continue;
    }
    if (isItalics(inline)) {
      validateInlinesStrict((inline as Italics).italics);
      continue;
    }
    if (isStrikethrough(inline)) {
      validateInlinesStrict((inline as Strikethrough).strike);
      continue;
    }
    if (isBlockquote(inline)) {
      validateInlinesStrict((inline as Blockquote).blockquote);
      continue;
    }
    if (isTask(inline)) {
      validateInlinesStrict((inline as Task).task.content);
      continue;
    }
    if (isInlineCode(inline)) continue;
    if (isLink(inline)) continue;
    if (isShip(inline)) continue;
    if (isSect(inline)) continue;
    if (isTag(inline)) continue;
    if (isBlockReference(inline)) continue;
    if (isBreak(inline)) continue;
    if (isBlockCode(inline)) continue;
    if (isCode(inline as unknown as Block)) continue;
    if (isImage(inline as unknown as Block)) continue;
    const description =
      typeof inline === 'object' && inline !== null
        ? `{ ${Object.keys(inline).join(', ')} }`
        : String(inline);
    throw new Error(`Unknown inline variant in strict mode: ${description}`);
  }
}

function validateListingStrict(listing: Listing): void {
  if (isListItem(listing)) {
    validateInlinesStrict(listing.item);
    return;
  }
  if (isList(listing)) {
    if (
      listing.list.type !== 'ordered' &&
      listing.list.type !== 'unordered' &&
      listing.list.type !== 'tasklist'
    ) {
      throw new Error(
        `Unknown list discriminator in strict mode: ${String(listing.list.type)}`
      );
    }
    validateInlinesStrict(listing.list.contents);
    for (const item of listing.list.items) {
      validateListingStrict(item);
    }
    return;
  }
  const description =
    typeof listing === 'object' && listing !== null
      ? `{ ${Object.keys(listing).join(', ')} }`
      : String(listing);
  throw new Error(`Unknown listing variant in strict mode: ${description}`);
}

function validateBlockStrict(block: Block): void {
  if (isHeader(block)) {
    validateInlinesStrict((block as Header).header.content);
    return;
  }
  if (isListing(block)) {
    validateListingStrict((block as ListingBlock).listing);
    return;
  }
  if (
    isCode(block) ||
    isImage(block) ||
    isRule(block) ||
    isKnownDeliberatelyUnsupportedBlock(block)
  ) {
    return;
  }
  const description =
    typeof block === 'object' && block !== null
      ? `{ ${Object.keys(block).join(', ')} }`
      : String(block);
  throw new Error(`Unknown block variant in strict mode: ${description}`);
}

/**
 * Convert Story (Verse[]) to mdast Root content array.
 */
export function storyToMdast(
  story: Story,
  opts?: StoryToMdastOptions
): RootContent[] {
  if (!story || story.length === 0) {
    return [];
  }

  if (opts?.strict) {
    for (const verse of story) {
      if (isBlockVerse(verse)) {
        validateBlockStrict(verse.block);
      } else {
        validateInlinesStrict(verse.inline);
      }
    }
  }

  const nodes: RootContent[] = [];

  for (const verse of story) {
    if (isBlockVerse(verse)) {
      nodes.push(...blockToMdast(verse.block, opts));
    } else {
      // VerseInline - can return multiple nodes if it contains blockquotes
      const inlineNodes = verseInlineToMdast(verse.inline, opts);
      nodes.push(...inlineNodes);
    }
  }

  return nodes;
}
