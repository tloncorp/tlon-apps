import { decodeNamedCharacterReference } from 'decode-named-character-reference';
import type { PhrasingContent, Text } from 'mdast';
import { decodeNumericCharacterReference } from 'micromark-util-decode-numeric-character-reference';
import type { Literal, Node } from 'unist';

import { visit } from './astUtils';

/**
 * Custom mdast node type for group/role mentions (@all, @admin, etc.)
 */
export interface GroupMention extends Literal {
  type: 'groupMention';
  value: string; // group/role name without the @
}

// `@` followed by an identifier-like token. Negative lookbehind rejects `@`
// preceded by an alphanumeric character so we don't match inside emails
// (`user@example.com`) or IDs (`abc123@foo`); punctuation and table syntax
// like `(@all)`, `,@all,`, `|@all|` all proceed to match.
const GROUP_MENTION_PATTERN = /(?<![A-Za-z0-9])@([a-z][a-z0-9-]*)/g;

/**
 * Parse text content and extract group mentions.
 * Returns an array of PhrasingContent, alternating between Text and GroupMention nodes.
 */
export function parseGroupMentions(text: string): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  let lastIndex = 0;

  const matches = text.matchAll(GROUP_MENTION_PATTERN);
  for (const match of matches) {
    if (match.index !== undefined && match.index > lastIndex) {
      const textNode: Text = {
        type: 'text',
        value: text.slice(lastIndex, match.index),
      };
      result.push(textNode);
    }

    const groupMention: GroupMention = {
      type: 'groupMention',
      value: match[1],
    };
    result.push(groupMention as unknown as PhrasingContent);
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  if (lastIndex < text.length) {
    const textNode: Text = {
      type: 'text',
      value: text.slice(lastIndex),
    };
    result.push(textNode);
  }

  return result;
}

export function transformGroupMentions(tree: Node): void {
  visit<Text>(tree, 'text', (node, index, parent) => {
    if (!parent || index === undefined) return;

    const parsed = parseGroupMentions(node.value);

    if (parsed.length === 1 && parsed[0].type === 'text') {
      return;
    }

    parent.children.splice(index, 1, ...parsed);
  });
}

/**
 * Serialize a group mention back to Markdown (@group).
 */
export function groupMentionToMarkdown(node: GroupMention): string {
  return `@${node.value}`;
}

/**
 * remark plugin that adds group-mention parsing support.
 * Transforms text nodes containing @group patterns into groupMention nodes.
 */
export function remarkGroupMentions() {
  return (tree: Node) => {
    transformGroupMentions(tree);
  };
}

// Typed role mentions, matched case-insensitively so `@Admin` resolves to the
// lowercase role id. One boundary rule for every caller: the character before
// `@` must not be `[A-Za-z0-9]` (emails, IDs), and the character after the
// token must not be `[A-Za-z0-9_-]`, so `@admin_team` is not `@admin` and
// `@all-_team` cannot backtrack to `@all`.
const ROLE_MENTION_TOKEN =
  /(?<![A-Za-z0-9])@([A-Za-z][A-Za-z0-9-]*)(?![A-Za-z0-9_-])/g;

type PhrasingParent = { children: PhrasingContent[] };

// Where an inline run starts and ends: text before or after one of these
// never touches a token inside it.
const PHRASING_BLOCKS = new Set(['paragraph', 'heading', 'tableCell']);
// Formatting is transparent: `**~zod**@all` still has `~zod` right before `@`.
const FORMATTING = new Set(['strong', 'emphasis', 'delete']);

type RunAtom =
  | { kind: 'text'; node: Text; parent: PhrasingParent }
  // A ship mention reads as a word character on both sides.
  | { kind: 'word' }
  | { kind: 'boundary' };

interface RoleMentionMatch {
  token: string;
  start: number;
  end: number;
}

interface TextMentions {
  node: Text;
  parent: PhrasingParent;
  matches: RoleMentionMatch[];
}

function flattenRun(
  nodes: PhrasingContent[],
  parent: PhrasingParent,
  out: RunAtom[]
): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      out.push({ kind: 'text', node, parent });
    } else if (FORMATTING.has(node.type) && 'children' in node) {
      flattenRun(
        node.children as PhrasingContent[],
        node as PhrasingParent,
        out
      );
    } else if ((node as Node).type === 'shipMention') {
      out.push({ kind: 'word' });
    } else {
      // Inline code, links (whose labels are flattened back to text, so a
      // converted label would lose its spelling), breaks and the rest: never
      // scanned, and nothing on either side reads through them.
      out.push({ kind: 'boundary' });
    }
  }
}

// The character adjacent to atom `index` in direction `step`, across sibling
// inlines: '' at a boundary, 'a' for a ship mention.
function adjacentChar(atoms: RunAtom[], index: number, step: 1 | -1): string {
  for (let i = index + step; i >= 0 && i < atoms.length; i += step) {
    const atom = atoms[i];
    if (atom.kind === 'word') return 'a';
    if (atom.kind === 'boundary') return '';
    if (atom.node.value !== '') {
      return step === 1 ? atom.node.value[0] : atom.node.value.slice(-1);
    }
  }
  return '';
}

const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
// The character references micromark decodes in text (named, decimal, hex).
const CHARACTER_REFERENCE =
  /&(?:#[xX]([0-9A-Fa-f]{1,6})|#([0-9]{1,7})|([A-Za-z0-9]{1,31}));/y;

function decodeReference(
  raw: string,
  at: number
): { length: number; value: string } | null {
  CHARACTER_REFERENCE.lastIndex = at;
  const match = CHARACTER_REFERENCE.exec(raw);
  if (!match) return null;
  const value = match[1]
    ? decodeNumericCharacterReference(match[1], 16)
    : match[2]
      ? decodeNumericCharacterReference(match[2], 10)
      : decodeNamedCharacterReference(match[3]);
  return value ? { length: match[0].length, value } : null;
}

// The source offset of each character of a text node's decoded value, or null
// when the two can't be aligned. A backslash escape or character reference
// maps to its first source character, so only a typed `@` maps to an `@`.
function sourceOffsets(value: string, raw: string): number[] | null {
  const offsets: number[] = [];
  let i = 0;
  let j = 0;
  while (i < value.length) {
    if (j >= raw.length) return null;
    const char = raw[j];
    if (
      char === '\\' &&
      ASCII_PUNCTUATION.test(raw[j + 1] ?? '') &&
      value[i] === raw[j + 1]
    ) {
      offsets.push(j);
      i += 1;
      j += 2;
      continue;
    }
    if (char === '&') {
      const reference = decodeReference(raw, j);
      if (reference && value.startsWith(reference.value, i)) {
        for (let k = 0; k < reference.value.length; k += 1) offsets.push(j);
        i += reference.value.length;
        j += reference.length;
        continue;
      }
    }
    if (value[i] === char) {
      offsets.push(j);
      i += 1;
      j += 1;
      continue;
    }
    // Whitespace trimmed at line edges and blockquote markers on continuation
    // lines are in the source but not in the value.
    if (char === ' ' || char === '\t' || char === '>') {
      j += 1;
      continue;
    }
    return null;
  }
  return offsets;
}

// Whether the match at [start, end) in a text node was typed literally.
// Markdown has already decoded `\@` and `&#64;` (and `@&#97;ll`) into the
// value, and an escaped mention must stay text. A node that can't be traced
// to its source never converts.
function typedLiterally(
  node: Text,
  start: number,
  end: number,
  source: string
): boolean {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  if (from === undefined || to === undefined) return false;
  const offsets = sourceOffsets(node.value, source.slice(from, to));
  if (offsets === null) return false;
  for (let k = start; k < end; k += 1) {
    if (
      offsets[k] !== offsets[start] + (k - start) ||
      source[from + offsets[k]] !== node.value[k]
    ) {
      return false;
    }
  }
  return true;
}

function scanRun(atoms: RunAtom[], source: string, out: TextMentions[]): void {
  atoms.forEach((atom, index) => {
    if (atom.kind !== 'text') return;
    const before = adjacentChar(atoms, index, -1);
    const after = adjacentChar(atoms, index, 1);
    const value = atom.node.value;
    const matches: RoleMentionMatch[] = [];
    // Scanning with the neighbours' characters attached applies the regex's
    // boundaries across inlines; a match that starts or ends outside this
    // node is not a mention.
    for (const match of `${before}${value}${after}`.matchAll(
      ROLE_MENTION_TOKEN
    )) {
      const start = (match.index ?? 0) - before.length;
      const end = start + match[0].length;
      if (
        start >= 0 &&
        end <= value.length &&
        typedLiterally(atom.node, start, end, source)
      ) {
        matches.push({ token: match[1], start, end });
      }
    }
    if (matches.length > 0) {
      out.push({ node: atom.node, parent: atom.parent, matches });
    }
  });
}

// Every role-mention token in document order. Shared by the candidate scan and
// the transform so a token one accepts is exactly a token the other sees.
function findRoleMentions(tree: Node, source: string): TextMentions[] {
  const found: TextMentions[] = [];
  const walk = (node: Node): void => {
    // Footnote definitions are dropped from the Story, so nothing in them is
    // sent; fenced code has no children.
    if (node.type === 'footnoteDefinition') return;
    if (!('children' in node) || !Array.isArray(node.children)) return;
    if (PHRASING_BLOCKS.has(node.type)) {
      const atoms: RunAtom[] = [];
      flattenRun(
        node.children as PhrasingContent[],
        node as PhrasingParent,
        atoms
      );
      scanRun(atoms, source, found);
      return;
    }
    for (const child of node.children as Node[]) walk(child);
  };
  walk(tree);
  return found;
}

/**
 * The `@word` tokens a parsed tree would offer as role mentions, as typed and
 * de-duplicated case-insensitively (first spelling kept). Includes `all`.
 * `source` is the Markdown the tree was parsed from.
 */
export function collectRoleMentionTokens(tree: Node, source: string): string[] {
  const seen = new Map<string, string>();
  for (const { matches } of findRoleMentions(tree, source)) {
    for (const { token } of matches) {
      const key = token.toLowerCase();
      if (!seen.has(key)) seen.set(key, token);
    }
  }
  return [...seen.values()];
}

/**
 * Turn `@all` and `@<id>` for ids in `roleIds` (lowercase) into groupMention
 * nodes; every other token stays text as typed.
 */
export function transformRoleMentions(
  tree: Node,
  roleIds: ReadonlySet<string>,
  source: string
): void {
  for (const { node, parent, matches } of findRoleMentions(tree, source)) {
    const replacement: PhrasingContent[] = [];
    let lastIndex = 0;
    for (const { token, start, end } of matches) {
      const id = token.toLowerCase();
      if (id !== 'all' && !roleIds.has(id)) continue;
      if (start > lastIndex) {
        replacement.push({
          type: 'text',
          value: node.value.slice(lastIndex, start),
        });
      }
      const mention: GroupMention = { type: 'groupMention', value: id };
      replacement.push(mention as unknown as PhrasingContent);
      lastIndex = end;
    }
    if (lastIndex === 0) continue;
    if (lastIndex < node.value.length) {
      replacement.push({ type: 'text', value: node.value.slice(lastIndex) });
    }
    parent.children.splice(parent.children.indexOf(node), 1, ...replacement);
  }
}
