import { Story } from '@tloncorp/api/urbit/channel';
import { Block, Inline } from '@tloncorp/api/urbit/content';
import type { Node, PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import { visit, visitAll } from './astUtils';
import type { ShipMention } from './shipMentionPlugin';
import { inlinesToPhrasing, storyToMdast } from './storyToMdast';

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

/**
 * Make lists tight (no blank lines between items).
 * By default, remark-stringify checks if children have multiple paragraphs.
 */
function makeTightLists(tree: Node): void {
  visitAll<{ spread?: boolean }>(tree, 'list', (listNode) => {
    listNode.spread = false;
  });
  visitAll<{ spread?: boolean }>(tree, 'listItem', (itemNode) => {
    itemNode.spread = false;
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
  .use(remarkGfm);

/**
 * Convert a Story (Verse[]) to a Markdown string.
 *
 * Converts the Story to mdast AST and serializes using remark-stringify.
 * Supports all Story types including ship mentions.
 */
export function storyToMarkdown(story: Story): string {
  if (!story || story.length === 0) {
    return '';
  }

  const children = storyToMdast(story);
  const tree: Root = { type: 'root', children };

  // Make lists tight and transform ship mentions before serialization
  makeTightLists(tree);
  transformShipMentionsToHtml(tree);

  const markdown = processor.stringify(tree).trim();
  return markdown;
}

/**
 * Convert an array of Inline elements to a Markdown string.
 * Useful for converting inline content outside of full Story context.
 */
export function inlinesToMarkdown(inlines: Inline[]): string {
  if (!inlines || inlines.length === 0) {
    return '';
  }

  const children = inlinesToPhrasing(inlines);
  const paragraph: RootContent = { type: 'paragraph', children };
  const tree: Root = { type: 'root', children: [paragraph] };

  // Transform ship mentions before serialization
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
