import {
  Block,
  Bold,
  Blockquote,
  Code,
  Header,
  Image,
  Inline,
  InlineCode,
  Italics,
  Link,
  List,
  ListItem,
  Listing,
  ListingBlock,
  Rule,
  Ship,
  Strikethrough,
  Task,
  isBold,
  isBlock,
  isBlockCode,
  isBlockquote,
  isBreak,
  isCode,
  isHeader,
  isImage,
  isInlineCode,
  isItalics,
  isLink,
  isListing,
  isList,
  isListItem,
  isShip,
  isStrikethrough,
  isTask,
} from '@tloncorp/api/urbit/content';
import { Story, isBlockVerse } from '@tloncorp/api/urbit/channel';

/**
 * Escape HTML special characters in text content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isRuleBlock(block: Block): block is Rule {
  return 'rule' in block;
}

/**
 * Strip trailing break inlines from an array.
 */
/**
 * Strip trailing breaks and whitespace-only strings from an inline array.
 */
function stripTrailingBreaks(inlines: Inline[]): Inline[] {
  const result = [...inlines];
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (isBreak(last)) {
      result.pop();
    } else if (typeof last === 'string' && !last.trim()) {
      result.pop();
    } else {
      break;
    }
  }
  return result;
}

/**
 * Strip leading breaks and whitespace-only strings from an inline array.
 */
function stripLeadingBreaks(inlines: Inline[]): Inline[] {
  const result = [...inlines];
  while (result.length > 0) {
    const first = result[0];
    if (isBreak(first)) {
      result.shift();
    } else if (typeof first === 'string' && !first.trim()) {
      result.shift();
    } else {
      break;
    }
  }
  return result;
}

/**
 * Clean an inline array by stripping leading/trailing whitespace and breaks.
 */
function cleanInlines(inlines: Inline[]): Inline[] {
  return stripTrailingBreaks(stripLeadingBreaks(inlines));
}

/**
 * Check if an inline is a block-level element that should not be wrapped in <p>.
 */
function isBlockLevelInline(inline: Inline): boolean {
  if (typeof inline === 'string') return false;
  return (
    isBlockquote(inline) ||
    isBlockCode(inline) ||
    isCode(inline as unknown as Block) ||
    isListing(inline as unknown as Block)
  );
}

/**
 * Convert an array of Inline elements to an HTML string.
 */
function inlinesToHtml(inlines: Inline[]): string {
  const parts: string[] = [];

  for (const inline of inlines) {
    if (typeof inline === 'string') {
      parts.push(escapeHtml(inline));
      continue;
    }

    if (isBold(inline)) {
      const bold = inline as Bold;
      parts.push(`<b>${inlinesToHtml(bold.bold)}</b>`);
      continue;
    }

    if (isItalics(inline)) {
      const italics = inline as Italics;
      parts.push(`<i>${inlinesToHtml(italics.italics)}</i>`);
      continue;
    }

    if (isStrikethrough(inline)) {
      const strike = inline as Strikethrough;
      parts.push(`<s>${inlinesToHtml(strike.strike)}</s>`);
      continue;
    }

    if (isInlineCode(inline)) {
      const code = inline as InlineCode;
      parts.push(`<code>${escapeHtml(code['inline-code'])}</code>`);
      continue;
    }

    if (isLink(inline)) {
      const link = inline as Link;
      parts.push(
        `<a href="${escapeHtml(link.link.href)}">${escapeHtml(link.link.content)}</a>`
      );
      continue;
    }

    if (isShip(inline)) {
      const ship = inline as Ship;
      const escaped = escapeHtml(ship.ship);
      parts.push(
        `<mention text="${escaped}" indicator="~" id="~${escaped}">~${escaped}</mention>`
      );
      continue;
    }

    if (isBreak(inline)) {
      parts.push('<br>');
      continue;
    }

    if (isTask(inline)) {
      const task = inline as Task;
      const checkbox = task.task.checked ? '[x]' : '[ ]';
      parts.push(
        `${checkbox} ${inlinesToHtml(stripTrailingBreaks(task.task.content))}`
      );
      continue;
    }

    if (isBlockquote(inline)) {
      const bq = inline as Blockquote;
      parts.push(
        `<blockquote><p>${inlinesToHtml(cleanInlines(bq.blockquote))}</p></blockquote>`
      );
      continue;
    }

    if (isBlockCode(inline)) {
      const codeContent = (inline as { code: string }).code;
      const codeLines = escapeHtml(codeContent).split('\n');
      parts.push(`<codeblock>${codeLines.map((l) => `<p>${l}</p>`).join('')}</codeblock>`);
      continue;
    }

    // Handle Code block in inline context
    if (isCode(inline as unknown as Block)) {
      const code = inline as unknown as Code;
      const codeLines = escapeHtml(code.code.code).split('\n');
      parts.push(`<codeblock>${codeLines.map((l) => `<p>${l}</p>`).join('')}</codeblock>`);
      continue;
    }

    // Handle Image in inline context
    if (isImage(inline as unknown as Block)) {
      const image = inline as unknown as Image;
      const alt = image.image.alt ? ` alt="${escapeHtml(image.image.alt)}"` : '';
      parts.push(`<img src="${escapeHtml(image.image.src)}"${alt}>`);
      continue;
    }
  }

  return parts.join('');
}

/**
 * Convert a Listing to HTML list items.
 */
function listingToHtml(listings: Listing[], listType: string): string {
  const items: string[] = [];

  for (const listing of listings) {
    if (isListItem(listing)) {
      const listItem = listing as ListItem;

      const cleanedItem = stripTrailingBreaks(listItem.item);
      if (listType === 'tasklist' && cleanedItem.length > 0 && isTask(cleanedItem[0])) {
        const task = cleanedItem[0] as Task;
        const checked = task.task.checked ? ' checked' : '';
        items.push(
          `<li${checked}>${inlinesToHtml(stripTrailingBreaks(task.task.content))}</li>`
        );
      } else {
        items.push(`<li>${inlinesToHtml(cleanedItem)}</li>`);
      }
    } else if (isList(listing)) {
      const list = listing as List;
      const tag = list.list.type === 'ordered' ? 'ol' : 'ul';
      const contentsHtml = inlinesToHtml(list.list.contents);
      const nestedHtml = `<${tag}>${listingToHtml(list.list.items, list.list.type)}</${tag}>`;
      items.push(`<li>${contentsHtml}${nestedHtml}</li>`);
    }
  }

  return items.join('');
}

/**
 * Convert a Story Block to HTML.
 */
function blockToHtml(block: Block): string {
  if (isHeader(block)) {
    const header = block as Header;
    const tag = header.header.tag;
    return `<${tag}>${inlinesToHtml(header.header.content)}</${tag}>`;
  }

  if (isCode(block)) {
    const code = block as Code;
    const codeLines = escapeHtml(code.code.code).split('\n');
    return `<codeblock>${codeLines.map((l) => `<p>${l}</p>`).join('')}</codeblock>`;
  }

  if (isImage(block)) {
    const image = block as Image;
    const alt = image.image.alt ? ` alt="${escapeHtml(image.image.alt)}"` : '';
    return `<p><img src="${escapeHtml(image.image.src)}"${alt}></p>`;
  }

  if (isRuleBlock(block)) {
    return '<hr>';
  }

  if (isListing(block)) {
    const listingBlock = block as ListingBlock;
    const listing = listingBlock.listing;

    if (isList(listing)) {
      const list = listing as List;
      if (list.list.type === 'tasklist') {
        // Add <br> before checkbox list to prevent the enriched editor
        // from absorbing the previous element into the list
        return `<br><ul data-type="checkbox">${listingToHtml(list.list.items, list.list.type)}</ul>`;
      }
      const tag = list.list.type === 'ordered' ? 'ol' : 'ul';
      return `<${tag}>${listingToHtml(list.list.items, list.list.type)}</${tag}>`;
    } else if (isListItem(listing)) {
      return `<ul>${listingToHtml([listing], 'unordered')}</ul>`;
    }
  }

  return '';
}

/**
 * Convert a Story (Verse[]) to an HTML string.
 *
 * Produces HTML compatible with react-native-enriched's setValue/getHTML format:
 * <p>, <strong>, <em>, <del>, <code>, <pre>, <blockquote>,
 * <h1>-<h6>, <ul>, <ol>, <li>, <a>, <img>, <br>, <hr>
 */
export function storyToHtml(story: Story): string {
  if (!story || story.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const verse of story) {
    if (isBlockVerse(verse)) {
      const html = blockToHtml(verse.block);
      if (html) {
        parts.push(html);
      }
    } else {
      // VerseInline — check for empty line (just a break)
      const inlines = verse.inline;
      if (
        inlines.length === 1 &&
        typeof inlines[0] === 'object' &&
        inlines[0] !== null &&
        isBreak(inlines[0])
      ) {
        parts.push('<br>');
        continue;
      }

      // Split on block-level elements (blockquotes, code blocks)
      // that should not be wrapped in <p>
      let currentSegment: Inline[] = [];

      const flushSegment = () => {
        if (currentSegment.length > 0) {
          const cleaned = cleanInlines(currentSegment);
          if (cleaned.length > 0) {
            parts.push(`<p>${inlinesToHtml(cleaned)}</p>`);
          }
          currentSegment = [];
        }
      };

      for (let i = 0; i < inlines.length; i++) {
        const item = inlines[i];

        if (isBlockLevelInline(item)) {
          // Flush current segment as <p>, then render block-level element directly
          flushSegment();
          parts.push(inlinesToHtml([item]));
        } else {
          // Skip breaks right before block-level elements
          if (
            isBreak(item) &&
            i + 1 < inlines.length &&
            isBlockLevelInline(inlines[i + 1])
          ) {
            continue;
          }
          currentSegment.push(item);
        }
      }

      flushSegment();
    }
  }

  return parts.join('');
}
