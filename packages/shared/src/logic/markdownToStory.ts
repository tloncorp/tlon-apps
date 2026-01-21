import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import {
  Block,
  Blockquote,
  Bold,
  Break,
  Code,
  Header,
  HeaderLevel,
  Image,
  Inline,
  InlineCode,
  Italics,
  Link,
  List,
  ListingBlock,
  ListItem,
  Listing,
  Rule,
  Ship,
  Strikethrough,
  Task,
} from '../urbit/content';
import { Verse, VerseInline } from '../urbit/channel';

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

/**
 * Get an attribute value from a token.
 */
function getTokenAttr(token: Token, name: string): string | null {
  if (token.attrs) {
    for (const attr of token.attrs) {
      if (attr[0] === name) {
        return attr[1];
      }
    }
  }
  return null;
}

/**
 * Check if a token has a class attribute containing the given value.
 */
function hasClass(token: Token, className: string): boolean {
  const classAttr = getTokenAttr(token, 'class');
  return classAttr ? classAttr.split(' ').includes(className) : false;
}

/**
 * Find the close token index for an open token.
 */
function findBlockCloseToken(
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
 * Extract inline content from list item tokens.
 * Returns the inline tokens as Inline[], handling task list checkboxes.
 */
function extractListItemInlines(tokens: Token[]): {
  inlines: Inline[];
  checked?: boolean;
} {
  const inlineToken = tokens.find((t) => t.type === 'inline');
  if (!inlineToken || !inlineToken.children) {
    return { inlines: [] };
  }

  const children = inlineToken.children;

  // Check if this is a task list item (has html_inline with checkbox)
  if (
    children.length > 0 &&
    children[0].type === 'html_inline' &&
    children[0].content.includes('task-list-item-checkbox')
  ) {
    const isChecked = children[0].content.includes('checked=""');
    // Skip the checkbox and leading space, get remaining content
    const remainingTokens = children.slice(1);
    const inlines = tokensToInlines(remainingTokens);
    // Trim leading space from first inline if it's a string
    if (inlines.length > 0 && typeof inlines[0] === 'string') {
      inlines[0] = (inlines[0] as string).trimStart();
    }
    return { inlines, checked: isChecked };
  }

  return { inlines: tokensToInlines(children) };
}

/**
 * Parse list tokens into a List structure.
 * Handles nested lists recursively.
 */
function parseListTokens(
  tokens: Token[],
  listType: 'ordered' | 'unordered' | 'tasklist'
): List {
  const items: Listing[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'list_item_open') {
      // Find the close of this list item
      const itemCloseIdx = findBlockCloseToken(
        tokens,
        i,
        'list_item_open',
        'list_item_close'
      );
      if (itemCloseIdx === -1) {
        i++;
        continue;
      }

      const itemTokens = tokens.slice(i + 1, itemCloseIdx);

      // Check for nested list
      const nestedBulletIdx = itemTokens.findIndex(
        (t) => t.type === 'bullet_list_open'
      );
      const nestedOrderedIdx = itemTokens.findIndex(
        (t) => t.type === 'ordered_list_open'
      );
      const nestedListIdx =
        nestedBulletIdx >= 0 && nestedOrderedIdx >= 0
          ? Math.min(nestedBulletIdx, nestedOrderedIdx)
          : Math.max(nestedBulletIdx, nestedOrderedIdx);

      if (nestedListIdx >= 0) {
        // Has nested list - extract content before nested list
        const contentTokens = itemTokens.slice(0, nestedListIdx);
        const { inlines, checked } = extractListItemInlines(contentTokens);

        // Parse nested list
        const nestedOpenToken = itemTokens[nestedListIdx];
        const nestedCloseType = nestedOpenToken.type.replace('_open', '_close');
        const nestedCloseIdx = findBlockCloseToken(
          itemTokens,
          nestedListIdx,
          nestedOpenToken.type,
          nestedCloseType
        );

        if (nestedCloseIdx >= 0) {
          const nestedListTokens = itemTokens.slice(
            nestedListIdx + 1,
            nestedCloseIdx
          );
          const nestedIsTaskList = hasClass(
            nestedOpenToken,
            'contains-task-list'
          );
          const nestedListType = nestedIsTaskList
            ? 'tasklist'
            : nestedOpenToken.type === 'ordered_list_open'
              ? 'ordered'
              : 'unordered';
          const nestedList = parseListTokens(nestedListTokens, nestedListType);

          // Create a List with contents (parent text) and items (nested list items)
          const contents =
            listType === 'tasklist' && checked !== undefined
              ? [{ task: { checked, content: inlines } } as Task]
              : inlines;

          const list: List = {
            list: {
              type: listType,
              contents,
              items: nestedList.list.items,
            },
          };
          items.push(list);
        } else {
          // Fallback if nested list close not found
          const contents =
            listType === 'tasklist' && checked !== undefined
              ? [{ task: { checked, content: inlines } } as Task]
              : inlines;
          const listItem: ListItem = { item: contents };
          items.push(listItem);
        }
      } else {
        // No nested list - simple list item
        const { inlines, checked } = extractListItemInlines(itemTokens);

        if (listType === 'tasklist' && checked !== undefined) {
          const task: Task = { task: { checked, content: inlines } };
          const listItem: ListItem = { item: [task] };
          items.push(listItem);
        } else {
          const listItem: ListItem = { item: inlines };
          items.push(listItem);
        }
      }

      i = itemCloseIdx + 1;
    } else {
      i++;
    }
  }

  return {
    list: {
      type: listType,
      contents: [],
      items,
    },
  };
}

/**
 * Convert heading tokens to a Header block.
 */
function parseHeadingTokens(tokens: Token[], startIdx: number): Header | null {
  const openToken = tokens[startIdx];
  const tag = openToken.tag as HeaderLevel;

  // Find inline content
  const inlineToken = tokens
    .slice(startIdx + 1)
    .find((t) => t.type === 'inline');
  if (!inlineToken) {
    return { header: { tag, content: [] } };
  }

  const content = inlineToken.children
    ? tokensToInlines(inlineToken.children)
    : [];
  return { header: { tag, content } };
}

/**
 * Convert an image token to an Image block.
 */
function parseImageToken(token: Token): Image {
  const src = getTokenAttr(token, 'src') || '';
  const alt = token.content || getTokenAttr(token, 'alt') || '';

  return {
    image: {
      src,
      height: 0,
      width: 0,
      alt,
    },
  };
}

/**
 * Parse blockquote tokens into a VerseInline with Blockquote inline.
 */
function parseBlockquoteTokens(
  tokens: Token[],
  startIdx: number,
  endIdx: number
): VerseInline {
  const innerTokens = tokens.slice(startIdx + 1, endIdx);
  const inlines: Inline[] = [];

  for (const token of innerTokens) {
    if (token.type === 'inline' && token.children) {
      inlines.push(...tokensToInlines(token.children));
    }
  }

  const blockquote: Blockquote = { blockquote: inlines };
  return { inline: [blockquote] };
}

/**
 * Convert a block token to a Story Block.
 * This processes block-level markdown tokens (heading, fence, hr, list, image).
 *
 * Returns { block, endIndex } where endIndex is the last token processed.
 * Returns null for tokens that don't map to blocks.
 */
export function tokenToBlock(
  tokens: Token[],
  startIndex: number
): { block: Block | null; verse?: Verse; endIndex: number } {
  const token = tokens[startIndex];

  switch (token.type) {
    case 'heading_open': {
      const closeIdx = findBlockCloseToken(
        tokens,
        startIndex,
        'heading_open',
        'heading_close'
      );
      const header = parseHeadingTokens(tokens, startIndex);
      return {
        block: header,
        endIndex: closeIdx >= 0 ? closeIdx : startIndex,
      };
    }

    case 'fence': {
      // Fenced code block
      const code: Code = {
        code: {
          code: token.content.replace(/\n$/, ''), // Remove trailing newline
          lang: token.info || '',
        },
      };
      return { block: code, endIndex: startIndex };
    }

    case 'hr': {
      const rule: Rule = { rule: null };
      return { block: rule, endIndex: startIndex };
    }

    case 'bullet_list_open':
    case 'ordered_list_open': {
      const closeType = token.type.replace('_open', '_close');
      const closeIdx = findBlockCloseToken(
        tokens,
        startIndex,
        token.type,
        closeType
      );
      if (closeIdx === -1) {
        return { block: null, endIndex: startIndex };
      }

      const listTokens = tokens.slice(startIndex + 1, closeIdx);
      const isTaskList = hasClass(token, 'contains-task-list');
      const listType = isTaskList
        ? 'tasklist'
        : token.type === 'ordered_list_open'
          ? 'ordered'
          : 'unordered';

      const list = parseListTokens(listTokens, listType);
      const listingBlock: ListingBlock = { listing: list };

      return { block: listingBlock, endIndex: closeIdx };
    }

    case 'blockquote_open': {
      const closeIdx = findBlockCloseToken(
        tokens,
        startIndex,
        'blockquote_open',
        'blockquote_close'
      );
      if (closeIdx === -1) {
        return { block: null, endIndex: startIndex };
      }

      const verse = parseBlockquoteTokens(tokens, startIndex, closeIdx);
      return { block: null, verse, endIndex: closeIdx };
    }

    case 'paragraph_open': {
      // Check for image in paragraph
      const closeIdx = findBlockCloseToken(
        tokens,
        startIndex,
        'paragraph_open',
        'paragraph_close'
      );
      if (closeIdx === -1) {
        return { block: null, endIndex: startIndex };
      }

      const innerTokens = tokens.slice(startIndex + 1, closeIdx);
      const inlineToken = innerTokens.find((t) => t.type === 'inline');

      if (
        inlineToken &&
        inlineToken.children &&
        inlineToken.children.length === 1 &&
        inlineToken.children[0].type === 'image'
      ) {
        const image = parseImageToken(inlineToken.children[0]);
        return { block: image, endIndex: closeIdx };
      }

      // Not a block-level element we handle
      return { block: null, endIndex: closeIdx };
    }

    default:
      return { block: null, endIndex: startIndex };
  }
}
