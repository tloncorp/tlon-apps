import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, PhrasingContent, Text, Node } from 'mdast';

import { Story } from '../../urbit/channel';
import { Block, Inline } from '../../urbit/content';
import { storyToMdast, inlinesToPhrasing } from './storyToMdast';
import type { ShipMention } from './shipMentionPlugin';

/**
 * Transform ship mention nodes to html nodes before serialization.
 * Using html nodes prevents escaping of the ~ character.
 */
function transformShipMentionsToHtml(tree: Node): void {
  visit(tree, 'shipMention', (node: ShipMention, index: number | undefined, parent: { children: PhrasingContent[] } | undefined) => {
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
  visitAll(tree, 'list', (listNode: { spread?: boolean }) => {
    listNode.spread = false;
  });
  visitAll(tree, 'listItem', (itemNode: { spread?: boolean }) => {
    itemNode.spread = false;
  });
}

/**
 * Simple tree visitor for all nodes of a type.
 */
function visitAll(
  tree: Node,
  type: string,
  visitor: (node: { spread?: boolean }) => void
): void {
  function walk(node: Node): void {
    if (node.type === type) {
      visitor(node as { spread?: boolean });
    }

    if ('children' in node && Array.isArray((node as { children: Node[] }).children)) {
      const children = (node as { children: Node[] }).children;
      for (const child of children) {
        walk(child);
      }
    }
  }

  walk(tree);
}

/**
 * Simple tree visitor for transformation.
 */
function visit(
  tree: Node,
  type: string,
  visitor: (node: ShipMention, index: number | undefined, parent: { children: PhrasingContent[] } | undefined) => void
): void {
  function walk(node: Node, index: number | undefined, parent: { children: PhrasingContent[] } | undefined): void {
    if (node.type === type) {
      visitor(node as ShipMention, index, parent);
    }

    if ('children' in node && Array.isArray((node as { children: Node[] }).children)) {
      const children = (node as { children: Node[] }).children;
      // Walk in reverse to handle mutations correctly
      for (let i = children.length - 1; i >= 0; i--) {
        walk(children[i], i, node as { children: PhrasingContent[] });
      }
    }
  }

  walk(tree, undefined, undefined);
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
