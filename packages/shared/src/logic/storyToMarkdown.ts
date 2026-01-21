import {
  Block,
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

  // Fallback for unhandled types (Sect, Tag, BlockReference, BlockCode, Blockquote)
  // These will be handled in later stories or return empty
  return '';
}

/**
 * Convert an array of Inline elements to a Markdown string.
 */
export function inlinesToMarkdown(inlines: Inline[]): string {
  return inlines.map(inlineToMarkdown).join('');
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

  // Code block
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
