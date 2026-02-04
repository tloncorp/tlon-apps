import type { Literal, Node } from 'unist';
import type { PhrasingContent, Text } from 'mdast';

import { visit } from './astUtils';

/**
 * Custom mdast node type for ship mentions (~zod, ~sampel-palnet, etc.)
 */
export interface ShipMention extends Literal {
  type: 'shipMention';
  value: string; // ship name without the ~
}

// Structural pattern: a galaxy/star name (3–6 letters) optionally followed by
// one or more 6-letter syllables separated by hyphens.  This is intentionally
// syntactic-only — valid('p') from @urbit/aura rejects non-phonemic syllables
// (e.g. test moons like ~dozzod-dozzod-sampel-palnet) and is only appropriate
// for autocomplete paths where real ships are selected, not free-text scanning.
const SHIP_PATTERN = /~[a-z]{3,6}(?:-[a-z]{6})*/g;

/**
 * Parse text content and extract ship mentions.
 * Returns an array of PhrasingContent, alternating between Text and ShipMention nodes.
 */
export function parseShipMentions(text: string): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  let lastIndex = 0;

  const matches = text.matchAll(SHIP_PATTERN);
  for (const match of matches) {
    // Add text before the ship mention
    if (match.index !== undefined && match.index > lastIndex) {
      const textNode: Text = {
        type: 'text',
        value: text.slice(lastIndex, match.index),
      };
      result.push(textNode);
    }

    // Add the ship mention (without the ~)
    const shipName = match[0].slice(1); // Remove leading ~
    const shipMention: ShipMention = {
      type: 'shipMention',
      value: shipName,
    };
    result.push(shipMention as unknown as PhrasingContent);
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textNode: Text = {
      type: 'text',
      value: text.slice(lastIndex),
    };
    result.push(textNode);
  }

  return result;
}

/**
 * Transform function that converts text nodes containing ship mentions
 * into a mix of text and shipMention nodes.
 */
export function transformShipMentions(tree: Node): void {
  visit<Text>(tree, 'text', (node, index, parent) => {
    if (!parent || index === undefined) return;

    const parsed = parseShipMentions(node.value);

    // If no ship mentions found, keep original node
    if (parsed.length === 1 && parsed[0].type === 'text') {
      return;
    }

    // Replace the text node with parsed content
    parent.children.splice(index, 1, ...parsed);
  });
}

/**
 * Serialize a ship mention back to Markdown (~ship-name).
 */
export function shipMentionToMarkdown(node: ShipMention): string {
  return `~${node.value}`;
}

/**
 * remark plugin that adds ship mention parsing support.
 * This transforms text nodes containing ~ship patterns into shipMention nodes.
 */
export function remarkShipMentions() {
  return (tree: Node) => {
    transformShipMentions(tree);
  };
}
