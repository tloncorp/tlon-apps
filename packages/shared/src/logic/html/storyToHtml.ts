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
      parts.push(`<strong>${inlinesToHtml(bold.bold)}</strong>`);
      continue;
    }

    if (isItalics(inline)) {
      const italics = inline as Italics;
      parts.push(`<em>${inlinesToHtml(italics.italics)}</em>`);
      continue;
    }

    if (isStrikethrough(inline)) {
      const strike = inline as Strikethrough;
      parts.push(`<del>${inlinesToHtml(strike.strike)}</del>`);
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
      parts.push(`${checkbox} ${inlinesToHtml(task.task.content)}`);
      continue;
    }

    if (isBlockquote(inline)) {
      const bq = inline as Blockquote;
      parts.push(
        `<blockquote><p>${inlinesToHtml(bq.blockquote)}</p></blockquote>`
      );
      continue;
    }

    if (isBlockCode(inline)) {
      const codeContent = (inline as { code: string }).code;
      parts.push(`<pre><code>${escapeHtml(codeContent)}</code></pre>`);
      continue;
    }

    // Handle Code block in inline context
    if (isCode(inline as unknown as Block)) {
      const code = inline as unknown as Code;
      parts.push(`<pre><code>${escapeHtml(code.code.code)}</code></pre>`);
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

      if (listType === 'tasklist' && listItem.item.length > 0 && isTask(listItem.item[0])) {
        const task = listItem.item[0] as Task;
        const checked = task.task.checked ? ' checked' : '';
        items.push(
          `<li><input type="checkbox"${checked} disabled>${inlinesToHtml(task.task.content)}</li>`
        );
      } else {
        items.push(`<li>${inlinesToHtml(listItem.item)}</li>`);
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
    return `<pre><code>${escapeHtml(code.code.code)}</code></pre>`;
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
      // VerseInline — split on blockquotes that need their own block
      const inlines = verse.inline;
      let currentSegment: Inline[] = [];

      for (let i = 0; i < inlines.length; i++) {
        const item = inlines[i];

        if (isBlockquote(item)) {
          // Flush current segment as <p>
          if (currentSegment.length > 0) {
            const html = inlinesToHtml(currentSegment);
            if (html) {
              parts.push(`<p>${html}</p>`);
            }
            currentSegment = [];
          }

          const bq = item as Blockquote;
          parts.push(
            `<blockquote><p>${inlinesToHtml(bq.blockquote)}</p></blockquote>`
          );
        } else {
          // Skip breaks right before blockquotes
          if (
            isBreak(item) &&
            i + 1 < inlines.length &&
            isBlockquote(inlines[i + 1])
          ) {
            continue;
          }
          currentSegment.push(item);
        }
      }

      // Flush remaining segment
      if (currentSegment.length > 0) {
        // Remove trailing breaks
        while (
          currentSegment.length > 0 &&
          isBreak(currentSegment[currentSegment.length - 1])
        ) {
          currentSegment.pop();
        }
        if (currentSegment.length > 0) {
          parts.push(`<p>${inlinesToHtml(currentSegment)}</p>`);
        }
      }
    }
  }

  return parts.join('');
}
