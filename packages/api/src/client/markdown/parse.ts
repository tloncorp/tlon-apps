import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { Story } from '../../urbit/channel';
import { remarkGroupMentions } from './groupMentionPlugin';
import { mdastToStory } from './mdastToStory';
import { remarkShipMentions } from './shipMentionPlugin';

/**
 * Processor that parses GFM plus ship and group/role mentions (`~zod`, `@all`,
 * `@admin`) into mention nodes.
 */
const mentionProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkShipMentions)
  .use(remarkGroupMentions);

/**
 * Processor that parses GFM only; `~ship`/`@role` text is left as plain text.
 * Used when mentions are tracked out-of-band (e.g. by entity position) rather
 * than detected from text patterns.
 */
const plainProcessor = unified().use(remarkParse).use(remarkGfm);

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
 * - Ship mentions (~zod, ~sampel-palnet, etc.) and group/role mentions (@all,
 *   @admin, etc.) when `parseMentions` is true (the default)
 *
 * Pass `parseMentions: false` to leave `~ship`/`@role` text untouched.
 */
export function markdownToStory(
  markdown: string,
  options: { parseMentions?: boolean } = {}
): Story {
  if (!markdown || markdown.trim() === '') {
    return [];
  }

  const { parseMentions = true } = options;
  const processor = parseMentions ? mentionProcessor : plainProcessor;
  const tree = processor.parse(markdown) as Root;
  processor.runSync(tree); // Apply transformations (mentions, etc.)

  return mdastToStory(tree.children);
}
