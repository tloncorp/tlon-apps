import type { PhrasingContent, Text } from 'mdast';
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

function scanRun(atoms: RunAtom[], out: TextMentions[]): void {
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
      if (start >= 0 && end <= value.length) {
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
function findRoleMentions(tree: Node): TextMentions[] {
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
      scanRun(atoms, found);
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
 */
export function collectRoleMentionTokens(tree: Node): string[] {
  const seen = new Map<string, string>();
  for (const { matches } of findRoleMentions(tree)) {
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
  roleIds: ReadonlySet<string>
): void {
  for (const { node, parent, matches } of findRoleMentions(tree)) {
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
