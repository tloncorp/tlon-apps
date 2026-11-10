import type { Root, Table } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { Story } from '../../urbit/channel';
import { visit } from './astUtils';
import { escapeCodeSpanPipes } from './codeSpanPipes';
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

function parseTree(markdown: string): Root {
  const tree = processor.parse(markdown) as Root;
  processor.runSync(tree); // Apply transformations (ship mentions, etc.)
  return tree;
}

// Escapes the pipes inside code spans on table body rows (see
// escapeCodeSpanPipes). Only the parsed tree knows which lines are table
// rows: the same `\|` in a code span outside a table is a literal backslash.
// Rows are located by source offset, which agrees with remark whatever the
// line endings. Header rows are left alone, since their cell count has to
// match the delimiter row for the table to exist at all.
function escapeTableCodeSpanPipes(markdown: string, tree: Root): string {
  const rows: Array<{ start: number; end: number }> = [];
  visit<Table>(tree, 'table', (table) => {
    for (const row of table.children.slice(1)) {
      const start = row.position?.start.offset;
      const end = row.position?.end.offset;
      if (start === undefined || end === undefined) continue;
      rows.push({ start, end });
    }
  });
  if (rows.length === 0) return markdown;
  rows.sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  for (const { start, end } of rows) {
    out +=
      markdown.slice(cursor, start) +
      escapeCodeSpanPipes(markdown.slice(start, end));
    cursor = end;
  }
  return out + markdown.slice(cursor);
}

// The tree and the Markdown it was parsed from, which differs from the input
// only when a table body row needed its code-span pipes escaped.
function parseMarkdown(markdown: string): { tree: Root; source: string } {
  const tree = parseTree(markdown);
  const source = escapeTableCodeSpanPipes(markdown, tree);
  return source === markdown
    ? { tree, source }
    : { tree: parseTree(source), source };
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

  const { tree, source } = parseMarkdown(markdown);
  if (options?.roleMentions) {
    transformRoleMentions(tree, options.roleMentions.roleIds, source);
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
  const { tree, source } = parseMarkdown(markdown);
  return collectRoleMentionTokens(tree, source);
}
