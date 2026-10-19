import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { Story } from '../../urbit/channel';
import {
  collectRoleMentionTokens,
  transformRoleMentions,
} from './groupMentionPlugin';
import { mdastToStory } from './mdastToStory';
import { remarkShipMentions } from './shipMentionPlugin';

/**
 * Create a unified processor for parsing Markdown to mdast.
 * Includes GFM support (tables, task lists, strikethrough) and ship mentions.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkShipMentions);

export interface MarkdownToStoryOptions {
  /**
   * Convert typed `@all` and `@<role-id>` into `%sect` mentions. Only ids in
   * `roleIds` (lowercase) convert, case-insensitively; an empty set converts
   * `@all` alone. Without this option every `@word` stays text.
   */
  roleMentions?: { roleIds: ReadonlySet<string> };
}

function parseMarkdown(markdown: string): Root {
  const tree = processor.parse(markdown) as Root;
  processor.runSync(tree); // Apply transformations (ship mentions, etc.)
  return tree;
}

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
 * - Role mentions (@all, @admin), only when `options.roleMentions` is given
 */
export function markdownToStory(
  markdown: string,
  options?: MarkdownToStoryOptions
): Story {
  if (!markdown || markdown.trim() === '') {
    return [];
  }

  const tree = parseMarkdown(markdown);
  if (options?.roleMentions) {
    transformRoleMentions(tree, options.roleMentions.roleIds);
  }

  return mdastToStory(tree.children);
}

/**
 * The `@word` tokens `markdownToStory` would consider as role mentions, as
 * typed, de-duplicated case-insensitively (first spelling kept), `all`
 * included. Read from the parsed tree, so code and link text never count,
 * and before tables and nested headings are flattened to text. Lets a caller
 * skip a role lookup when nothing but `@all` was typed, and name the tokens
 * its allow-list would leave as text.
 */
export function roleMentionCandidates(markdown: string): string[] {
  return collectRoleMentionTokens(parseMarkdown(markdown));
}
