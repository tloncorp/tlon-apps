import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import {
  Bold,
  Break,
  Inline,
  InlineCode,
  Italics,
  Link,
  Ship,
  Strikethrough,
} from '../urbit/content';

// Ship name pattern: ~[a-z]{3,6}(-[a-z]{6})*
const SHIP_PATTERN = /~[a-z]{3,6}(?:-[a-z]{6})*/g;

/**
 * Parse text content and extract ship mentions.
 * Returns an array of inlines, alternating between plain text and Ship objects.
 */
function parseTextWithShips(text: string): Inline[] {
  const result: Inline[] = [];
  let lastIndex = 0;

  const matches = text.matchAll(SHIP_PATTERN);
  for (const match of matches) {
    // Add text before the ship mention
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    // Add the ship mention (without the ~)
    const shipName = match[0].slice(1); // Remove leading ~
    const ship: Ship = { ship: shipName };
    result.push(ship);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

/**
 * Process a slice of tokens that form an inline wrapper (like strong, em, s, link).
 * Returns the inner tokens converted to Inlines.
 */
function processInlineTokenRange(
  tokens: Token[],
  startIndex: number,
  endIndex: number
): Inline[] {
  return tokensToInlines(tokens.slice(startIndex, endIndex));
}

/**
 * Find the matching close token for an open token.
 */
function findCloseToken(
  tokens: Token[],
  startIndex: number,
  openType: string,
  closeType: string
): number {
  let depth = 1;
  for (let i = startIndex + 1; i < tokens.length; i++) {
    if (tokens[i].type === openType) {
      depth++;
    } else if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Get the href attribute from a link_open token.
 */
function getLinkHref(token: Token): string {
  if (token.attrs) {
    for (const attr of token.attrs) {
      if (attr[0] === 'href') {
        return attr[1];
      }
    }
  }
  return '';
}

/**
 * Convert an array of markdown-it inline tokens to Story Inline types.
 */
export function tokensToInlines(tokens: Token[]): Inline[] {
  const result: Inline[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token.type) {
      case 'text': {
        // Parse text for ship mentions
        const parsed = parseTextWithShips(token.content);
        result.push(...parsed);
        i++;
        break;
      }

      case 'strong_open': {
        // Find matching close token
        const closeIdx = findCloseToken(tokens, i, 'strong_open', 'strong_close');
        if (closeIdx === -1) {
          i++;
          break;
        }
        const innerInlines = processInlineTokenRange(tokens, i + 1, closeIdx);
        const bold: Bold = { bold: innerInlines };
        result.push(bold);
        i = closeIdx + 1;
        break;
      }

      case 'em_open': {
        const closeIdx = findCloseToken(tokens, i, 'em_open', 'em_close');
        if (closeIdx === -1) {
          i++;
          break;
        }
        const innerInlines = processInlineTokenRange(tokens, i + 1, closeIdx);
        const italics: Italics = { italics: innerInlines };
        result.push(italics);
        i = closeIdx + 1;
        break;
      }

      case 's_open': {
        const closeIdx = findCloseToken(tokens, i, 's_open', 's_close');
        if (closeIdx === -1) {
          i++;
          break;
        }
        const innerInlines = processInlineTokenRange(tokens, i + 1, closeIdx);
        const strike: Strikethrough = { strike: innerInlines };
        result.push(strike);
        i = closeIdx + 1;
        break;
      }

      case 'code_inline': {
        const inlineCode: InlineCode = { 'inline-code': token.content };
        result.push(inlineCode);
        i++;
        break;
      }

      case 'link_open': {
        const closeIdx = findCloseToken(tokens, i, 'link_open', 'link_close');
        if (closeIdx === -1) {
          i++;
          break;
        }
        const href = getLinkHref(token);
        const innerInlines = processInlineTokenRange(tokens, i + 1, closeIdx);
        // For Link, content is a string, so we need to flatten the inner inlines
        const contentText = innerInlines
          .map((inline) => {
            if (typeof inline === 'string') return inline;
            // For nested formatting, extract text content
            return '';
          })
          .join('');
        const link: Link = {
          link: {
            href,
            content: contentText || href,
          },
        };
        result.push(link);
        i = closeIdx + 1;
        break;
      }

      case 'softbreak':
      case 'hardbreak': {
        const lineBreak: Break = { break: null };
        result.push(lineBreak);
        i++;
        break;
      }

      // Skip close tokens as they're handled by their open counterparts
      case 'strong_close':
      case 'em_close':
      case 's_close':
      case 'link_close':
        i++;
        break;

      default:
        // Skip unknown token types
        i++;
        break;
    }
  }

  return result;
}
