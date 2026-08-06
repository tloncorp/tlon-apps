import type { Node, PhrasingContent, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import { Story } from '../../urbit/channel';
import { Block, Inline } from '../../urbit/content';
import { visit, visitAll } from './astUtils';
import { type ShipMention, transformShipMentions } from './shipMentionPlugin';
import {
  type StoryToMdastOptions,
  inlinesToMdast,
  storyToMdast,
} from './storyToMdast';

/**
 * Transform ship mention nodes to html nodes before serialization.
 * Using html nodes prevents escaping of the ~ character.
 */
function transformShipMentionsToHtml(tree: Node): void {
  visit<ShipMention>(tree, 'shipMention', (node, index, parent) => {
    if (!parent || index === undefined) return;

    // Replace shipMention with html node to prevent escaping
    const htmlNode = {
      type: 'html',
      value: `~${node.value}`,
    };
    parent.children[index] = htmlNode as unknown as PhrasingContent;
  });
}

function wrapShipMentionsNextToStrike(node: Node): void {
  const parent = node as Node & { type?: string; children?: Node[] };
  if (!Array.isArray(parent.children)) return;

  for (const child of parent.children) {
    wrapShipMentionsNextToStrike(child);
  }

  for (let index = 0; index < parent.children.length; index += 1) {
    const first = parent.children[index] as unknown as ShipMention;
    if (first.type !== 'shipMention') continue;

    let count = 1;
    while (
      (parent.children[index + count] as unknown as ShipMention | undefined)
        ?.type === 'shipMention'
    ) {
      count += 1;
    }
    const touchesStrike =
      (parent.type === 'delete' && index === 0) ||
      parent.children[index - 1]?.type === 'delete';
    if (!touchesStrike) {
      index += count - 1;
      continue;
    }

    const value = parent.children
      .slice(index, index + count)
      .map(
        (child) => `<span>~${(child as unknown as ShipMention).value}</span>`
      )
      .join('');
    parent.children.splice(index, count, {
      type: 'html',
      value,
    } as unknown as Node);
  }
}

function insertInvisibleComment(children: Node[], index: number): void {
  children.splice(index, 0, {
    type: 'html',
    value: '<!-- -->',
  } as unknown as Node);
}

/**
 * GFM strike delimiters use micromark's left/right-flanking rules. Inside a
 * strong, emphasis, or delete parent, a delete child that directly touches
 * another phrasing sibling can therefore merge delimiter runs or change how
 * the surrounding delimiters are classified. Insert an HTML comment on each
 * touching side of that delete child, except beside a hard break or existing
 * HTML sibling. The comment is a delimiter boundary but contributes no visible
 * content, and `mdastToStory` deliberately discards inline HTML on reparse.
 */
function separateStrikeFromAdjacentPhrasing(node: Node): void {
  const parent = node as Node & { type?: string; children?: Node[] };
  if (!Array.isArray(parent.children)) return;

  for (const child of parent.children) {
    separateStrikeFromAdjacentPhrasing(child);
  }
  if (
    parent.type !== 'strong' &&
    parent.type !== 'emphasis' &&
    parent.type !== 'delete'
  ) {
    return;
  }
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    if (child.type !== 'delete') continue;

    const previous = parent.children[index - 1];
    if (previous && previous.type !== 'break' && previous.type !== 'html') {
      insertInvisibleComment(parent.children, index);
      index += 1;
    }

    const next = parent.children[index + 1];
    if (next && next.type !== 'break' && next.type !== 'html') {
      insertInvisibleComment(parent.children, index + 1);
      index += 1;
    }
  }
}

type AsteriskMark = Node & {
  type: 'strong' | 'emphasis';
  children: Node[];
};

function isAsteriskMark(node: Node | undefined): node is AsteriskMark {
  return (
    (node?.type === 'strong' || node?.type === 'emphasis') &&
    Array.isArray((node as AsteriskMark).children)
  );
}

function markEndsWithWord(node: AsteriskMark): boolean {
  const last = node.children[node.children.length - 1] as
    | (Node & { value?: unknown })
    | undefined;
  if (!last) return false;

  if (last.type === 'text' && typeof last.value === 'string') {
    return /[\p{L}\p{N}]$/u.test(last.value);
  }
  if (last.type === 'shipMention' && typeof last.value === 'string') {
    return /[\p{L}\p{N}]$/u.test(last.value);
  }
  return false;
}

function markStartsWithNonWordChild(node: AsteriskMark): boolean {
  const first = node.children[0] as (Node & { value?: unknown }) | undefined;
  if (!first) return false;

  if (first.type === 'link' || first.type === 'inlineCode') {
    return true;
  }
  return (
    first.type === 'text' &&
    typeof first.value === 'string' &&
    first.value.length > 0 &&
    !/^[\p{L}\p{N}]/u.test(first.value)
  );
}

/**
 * Adjacent strong/emphasis segments share an asterisk delimiter run. When the
 * first closes after a word and the second opens before non-word phrasing, a
 * segment ending at a lifted hard break can be reparsed as literal asterisks.
 * Split that otherwise ambiguous delimiter run with a content-neutral comment.
 */
function separateAmbiguousAdjacentMarksBeforeBreak(node: Node): void {
  const parent = node as Node & { children?: Node[] };
  if (!Array.isArray(parent.children)) return;

  for (const child of parent.children) {
    separateAmbiguousAdjacentMarksBeforeBreak(child);
  }

  for (let index = 0; index < parent.children.length - 2; index += 1) {
    const first = parent.children[index];
    const second = parent.children[index + 1];
    const next = parent.children[index + 2];
    if (
      isAsteriskMark(first) &&
      isAsteriskMark(second) &&
      first.type !== second.type &&
      next.type === 'break' &&
      markEndsWithWord(first) &&
      markStartsWithNonWordChild(second)
    ) {
      insertInvisibleComment(parent.children, index + 1);
      index += 1;
    }
  }
}

/**
 * A mark segment split at a lifted hard break can start immediately after
 * unmarked phrasing. If the marked segment ends at that break, micromark may
 * encode the final character of the preceding text as a numeric entity to
 * keep the delimiter parseable. An invisible HTML comment provides the same
 * content-neutral boundary without changing the visible Markdown text.
 */
function separateMarkedBreakFromPrecedingPhrasing(node: Node): void {
  const parent = node as Node & { children?: Node[] };
  if (!Array.isArray(parent.children)) return;

  for (const child of parent.children) {
    separateMarkedBreakFromPrecedingPhrasing(child);
  }

  for (let index = 1; index < parent.children.length - 1; index += 1) {
    const child = parent.children[index];
    const previous = parent.children[index - 1];
    const next = parent.children[index + 1];
    const isMark =
      child.type === 'strong' ||
      child.type === 'emphasis' ||
      child.type === 'delete';
    const previousIsUnmarked =
      previous.type !== 'strong' &&
      previous.type !== 'emphasis' &&
      previous.type !== 'delete' &&
      previous.type !== 'break' &&
      previous.type !== 'html';

    if (isMark && previousIsUnmarked && next.type === 'break') {
      insertInvisibleComment(parent.children, index);
      index += 1;
    }
  }
}

/**
 * Make lists tight (no blank lines between items), except for items explicitly
 * marked loose to protect a boundary between a blockquote and later phrasing.
 * By default, remark-stringify checks if children have multiple paragraphs.
 */
function makeTightLists(tree: Node): void {
  visitAll<{ spread?: boolean }>(tree, 'list', (listNode) => {
    listNode.spread = false;
  });
  visitAll<{ spread?: boolean }>(tree, 'listItem', (itemNode) => {
    if (itemNode.spread !== true) {
      itemNode.spread = false;
    }
  });
}

/**
 * Create a unified processor for serializing mdast to Markdown.
 */
const processor = unified()
  .use(remarkStringify, {
    bullet: '-',
    emphasis: '*',
    strong: '*',
    fence: '`',
    fences: true,
    listItemIndent: 'one',
    rule: '-',
    incrementListMarker: true,
  })
  .use(remarkGfm, { singleTilde: false });

/**
 * Convert a Story (Verse[]) to a Markdown string.
 *
 * Converts the Story to mdast AST and serializes using remark-stringify.
 * Supports all Story types including ship mentions.
 */
export function storyToMarkdown(
  story: Story,
  opts?: StoryToMdastOptions
): string {
  if (!story || story.length === 0) {
    return '';
  }

  const children = storyToMdast(story, opts);
  const tree: Root = { type: 'root', children };

  // Canonicalize mention-shaped text the same way the Markdown parser does,
  // then transform mentions before serialization so their sigils stay bare.
  makeTightLists(tree);
  transformShipMentions(tree);
  wrapShipMentionsNextToStrike(tree);
  separateStrikeFromAdjacentPhrasing(tree);
  separateAmbiguousAdjacentMarksBeforeBreak(tree);
  separateMarkedBreakFromPrecedingPhrasing(tree);
  transformShipMentionsToHtml(tree);

  const markdown = processor.stringify(tree).trim();
  return markdown;
}

/**
 * Convert an array of Inline elements to a Markdown string.
 * Useful for converting inline content outside of full Story context.
 */
export function inlinesToMarkdown(
  inlines: Inline[],
  opts?: StoryToMdastOptions
): string {
  if (!inlines || inlines.length === 0) {
    return '';
  }

  const children = inlinesToMdast(inlines, opts);
  const tree: Root = { type: 'root', children };

  // Canonicalize and transform ship mentions before serialization
  transformShipMentions(tree);
  wrapShipMentionsNextToStrike(tree);
  separateStrikeFromAdjacentPhrasing(tree);
  separateAmbiguousAdjacentMarksBeforeBreak(tree);
  separateMarkedBreakFromPrecedingPhrasing(tree);
  transformShipMentionsToHtml(tree);

  return processor.stringify(tree).trim();
}

/**
 * Convert a Block element to a Markdown string.
 * Useful for converting single blocks outside of full Story context.
 */
export function blockToMarkdown(block: Block): string {
  const story: Story = [{ block }];
  return storyToMarkdown(story);
}

/**
 * Flatten a Story (Verse[]) into a contiguous (Inline | Block)[] array
 * suitable for use as post draft content.  A break is inserted between each
 * VerseInline to preserve paragraph boundaries in the flat representation.
 */
export function storyToContent(story: Story): (Inline | Block)[] {
  return story.flatMap((verse, index): (Inline | Block)[] => {
    if ('inline' in verse) {
      const isLast = index === story.length - 1;
      return isLast ? verse.inline : [...verse.inline, { break: null }];
    }
    return [verse.block];
  });
}
