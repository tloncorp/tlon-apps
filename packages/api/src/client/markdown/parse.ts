import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { Story } from '../../urbit/channel';
import { mdastToStory } from './mdastToStory';
import { remarkShipMentions } from './shipMentionPlugin';

/**
 * Create a unified processor for parsing Markdown to mdast.
 * Includes GFM support (tables, task lists, strikethrough) and ship mentions.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkShipMentions);

/**
 * Convert a Markdown string to a Story (Verse[]).
 *
 * Parses the markdown using remark (unified) and converts the mdast AST
 * to Story format:
 * - Paragraph nodes become VerseInline
 * - Block nodes (headers, code, lists, etc.) become VerseBlock
 * - Blockquotes become VerseInline with Blockquote inline
 *
 * Supports:
 * - Standard Markdown (bold, italic, links, images, headers, code blocks, lists)
 * - GFM extensions (task lists, tables, strikethrough)
 * - Ship mentions (~zod, ~sampel-palnet, etc.)
 */
export function markdownToStory(markdown: string): Story {
  if (!markdown || markdown.trim() === '') {
    return [];
  }

  const tree = processor.parse(markdown) as Root;
  processor.runSync(tree); // Apply transformations (ship mentions, etc.)

  return mdastToStory(tree.children);
}
