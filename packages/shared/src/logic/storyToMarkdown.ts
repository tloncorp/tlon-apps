import {
  Bold,
  Break,
  Inline,
  InlineCode,
  Italics,
  Link,
  Ship,
  Strikethrough,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isShip,
  isStrikethrough,
} from '../urbit/content';

/**
 * Convert a single inline element to Markdown.
 */
function inlineToMarkdown(inline: Inline): string {
  // Plain string
  if (typeof inline === 'string') {
    return inline;
  }

  // Bold
  if (isBold(inline)) {
    const inner = inlinesToMarkdown((inline as Bold).bold);
    return `**${inner}**`;
  }

  // Italics
  if (isItalics(inline)) {
    const inner = inlinesToMarkdown((inline as Italics).italics);
    return `*${inner}*`;
  }

  // Strikethrough
  if (isStrikethrough(inline)) {
    const inner = inlinesToMarkdown((inline as Strikethrough).strike);
    return `~~${inner}~~`;
  }

  // Inline code
  if (isInlineCode(inline)) {
    return `\`${(inline as InlineCode)['inline-code']}\``;
  }

  // Link
  if (isLink(inline)) {
    const link = inline as Link;
    return `[${link.link.content}](${link.link.href})`;
  }

  // Ship mention
  if (isShip(inline)) {
    return `~${(inline as Ship).ship}`;
  }

  // Line break
  if (isBreak(inline)) {
    return '\n';
  }

  // Fallback for unhandled types (Sect, Tag, BlockReference, BlockCode, Blockquote, Task)
  // These will be handled in later stories or return empty
  return '';
}

/**
 * Convert an array of Inline elements to a Markdown string.
 */
export function inlinesToMarkdown(inlines: Inline[]): string {
  return inlines.map(inlineToMarkdown).join('');
}
