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
