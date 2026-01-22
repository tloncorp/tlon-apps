import {
  Block,
  Blockquote,
  Bold,
  Break,
  Code,
  Header,
  Image,
  Inline,
  InlineCode,
  Italics,
  Link,
  List,
  Listing,
  ListingBlock,
  ListItem,
  Rule,
  Ship,
  Strikethrough,
  Task,
  isBlockCode,
  isBlockquote,
  isBold,
  isBreak,
  isCode,
  isHeader,
  isImage,
  isInlineCode,
  isItalics,
  isLink,
  isList,
  isListItem,
  isListing,
  isShip,
  isStrikethrough,
  isTask,
} from '../urbit/content';
import { isBlockVerse, Story, Verse } from '../urbit/channel';

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

  // Task (used in task lists)
  if (isTask(inline)) {
    const task = inline as Task;
    const checkbox = task.task.checked ? '[x]' : '[ ]';
    const content = inlinesToMarkdown(task.task.content);
    return `${checkbox} ${content}`;
  }

  // Blockquote
  if (isBlockquote(inline)) {
    const blockquote = inline as Blockquote;
    const content = inlinesToMarkdown(blockquote.blockquote);
    // Prefix each line with '> '
    return content
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }

  // BlockCode - simple { code: string } format (from JSONToInlines with codeWithLang=false)
  if (isBlockCode(inline)) {
    const codeContent = (inline as { code: string }).code;
    return `\`\`\`\n${codeContent}\n\`\`\``;
  }

  // Code block with lang - { code: { code: string, lang: string } } format
  if (isCode(inline as unknown as Block)) {
    const code = inline as unknown as Code;
    const lang = code.code.lang || '';
    return `\`\`\`${lang}\n${code.code.code}\n\`\`\``;
  }

  // Image - can appear in inline context from JSONToInlines
  if (isImage(inline as unknown as Block)) {
    const image = inline as unknown as Image;
    return `![${image.image.alt}](${image.image.src})`;
  }

  // Fallback for unhandled types (Sect, Tag, BlockReference)
  return '';
}

/**
 * Merge adjacent inline elements of the same type (italics, bold, strike).
 * This handles cases where Tiptap splits styled content into multiple segments.
 */
function mergeAdjacentMarks(inlines: Inline[]): Inline[] {
  if (inlines.length === 0) return inlines;

  const result: Inline[] = [];

  for (const inline of inlines) {
    const last = result[result.length - 1];

    // Check if we can merge with the previous element
    if (last && typeof last === 'object' && typeof inline === 'object') {
      // Check for italics merge
      if (isItalics(last) && isItalics(inline)) {
        const lastItalics = last as Italics;
        const currentItalics = inline as Italics;
        result[result.length - 1] = {
          italics: [...lastItalics.italics, ...currentItalics.italics],
        };
        continue;
      }

      // Check for bold merge
      if (isBold(last) && isBold(inline)) {
        const lastBold = last as Bold;
        const currentBold = inline as Bold;
        result[result.length - 1] = {
          bold: [...lastBold.bold, ...currentBold.bold],
        };
        continue;
      }

      // Check for strikethrough merge
      if (isStrikethrough(last) && isStrikethrough(inline)) {
        const lastStrike = last as Strikethrough;
        const currentStrike = inline as Strikethrough;
        result[result.length - 1] = {
          strike: [...lastStrike.strike, ...currentStrike.strike],
        };
        continue;
      }
    }

    result.push(inline);
  }

  return result;
}

/**
 * Convert an array of Inline elements to a Markdown string.
 */
export function inlinesToMarkdown(inlines: Inline[]): string {
  // Merge adjacent same-type marks before converting
  const merged = mergeAdjacentMarks(inlines);
  return merged.map(inlineToMarkdown).join('');
}

/**
 * Convert a Listing (List or ListItem) to Markdown lines.
 */
function listingToMarkdownLines(
  listing: Listing,
  indent: number = 0,
  listType: 'ordered' | 'unordered' | 'tasklist' = 'unordered',
  itemIndex: number = 0
): string[] {
  const indentStr = '  '.repeat(indent);

  if (isListItem(listing)) {
    const listItem = listing as ListItem;
    const content = inlinesToMarkdown(listItem.item);

    let prefix: string;
    if (listType === 'ordered') {
      prefix = `${itemIndex + 1}.`;
    } else if (listType === 'tasklist') {
      prefix = '-';
    } else {
      prefix = '-';
    }

    return [`${indentStr}${prefix} ${content}`];
  }

  if (isList(listing)) {
    const list = listing as List;
    const lines: string[] = [];

    // Add the list's own contents if any
    if (list.list.contents.length > 0) {
      const content = inlinesToMarkdown(list.list.contents);
      let prefix: string;
      if (list.list.type === 'ordered') {
        prefix = `${itemIndex + 1}.`;
      } else if (list.list.type === 'tasklist') {
        prefix = '-';
      } else {
        prefix = '-';
      }
      lines.push(`${indentStr}${prefix} ${content}`);
    }

    // Process nested items
    list.list.items.forEach((item, idx) => {
      const nestedLines = listingToMarkdownLines(
        item,
        list.list.contents.length > 0 ? indent + 1 : indent,
        list.list.type,
        idx
      );
      lines.push(...nestedLines);
    });

    return lines;
  }

  return [];
}

/**
 * Check if a block is a Rule (horizontal rule).
 */
function isRule(block: Block): block is Rule {
  return 'rule' in block;
}

/**
 * Convert a Block element to Markdown.
 */
export function blockToMarkdown(block: Block): string {
  // Header
  if (isHeader(block)) {
    const header = block as Header;
    const level = parseInt(header.header.tag.charAt(1), 10);
    const hashes = '#'.repeat(level);
    const content = inlinesToMarkdown(header.header.content);
    return `${hashes} ${content}`;
  }

  // Code block - { code: { code: string, lang: string } } format
  if (isCode(block)) {
    const code = block as Code;
    const lang = code.code.lang || '';
    return `\`\`\`${lang}\n${code.code.code}\n\`\`\``;
  }

  // Image
  if (isImage(block)) {
    const image = block as Image;
    return `![${image.image.alt}](${image.image.src})`;
  }

  // Rule (horizontal line)
  if (isRule(block)) {
    return '---';
  }

  // Listing (List)
  if (isListing(block)) {
    const listingBlock = block as ListingBlock;
    const lines = listingToMarkdownLines(listingBlock.listing);
    return lines.join('\n');
  }

  // Fallback for unhandled block types (Cite, LinkBlock)
  return '';
}

/**
 * Convert a Verse (VerseInline or VerseBlock) to Markdown.
 */
function verseToMarkdown(verse: Verse): string {
  if (isBlockVerse(verse)) {
    return blockToMarkdown(verse.block);
  }
  // VerseInline
  return inlinesToMarkdown(verse.inline);
}

/**
 * Convert a complete Story (array of Verse) to Markdown.
 */
export function storyToMarkdown(story: Story): string {
  if (!story || story.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const verse of story) {
    const markdown = verseToMarkdown(verse);
    if (markdown) {
      parts.push(markdown);
    }
  }

  // Join verses with double newlines for paragraph separation
  return parts.join('\n\n');
}
