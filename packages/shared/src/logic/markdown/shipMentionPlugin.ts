import { valid } from '@urbit/aura';
import type { Literal, Node } from 'unist';
import type { PhrasingContent, Text } from 'mdast';

/**
 * Custom mdast node type for ship mentions (~zod, ~sampel-palnet, etc.)
 */
export interface ShipMention extends Literal {
  type: 'shipMention';
  value: string; // ship name without the ~
}

// Structural pattern: a galaxy/star name (3–6 letters) optionally followed by
// one or more 6-letter syllables separated by hyphens.  Each structural match
// is validated with @urbit/aura's valid('p') before being treated as a ship.
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
    // Validate against @urbit/aura — skip structural matches that aren't
    // real ship names.  Skipped text is picked up as plain text by the next
    // iteration's "before" slice (or the trailing-text slice at the end).
    if (!valid('p', match[0])) continue;

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
  visit(tree, 'text', (node: Text, index: number | undefined, parent: { children: PhrasingContent[] } | undefined) => {
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
 * Simple tree visitor (avoids importing unist-util-visit for this small use case).
 */
function visit(
  tree: Node,
  type: string,
  visitor: (node: Text, index: number | undefined, parent: { children: PhrasingContent[] } | undefined) => void
): void {
  function walk(node: Node, index: number | undefined, parent: { children: PhrasingContent[] } | undefined): void {
    if (node.type === type) {
      visitor(node as Text, index, parent);
    }

    if ('children' in node && Array.isArray((node as { children: Node[] }).children)) {
      const children = (node as { children: Node[] }).children;
      // Walk in reverse to handle splice correctly
      for (let i = children.length - 1; i >= 0; i--) {
        walk(children[i], i, node as { children: PhrasingContent[] });
      }
    }
  }

  walk(tree, undefined, undefined);
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
