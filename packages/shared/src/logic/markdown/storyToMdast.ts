import type {
  Blockquote as MdastBlockquote,
  Code as MdastCode,
  Delete,
  Emphasis,
  Heading,
  Image as MdastImage,
  InlineCode as MdastInlineCode,
  Link as MdastLink,
  List as MdastList,
  ListItem as MdastListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Strong,
  Text,
  ThematicBreak,
} from 'mdast';

import {
  Block,
  Inline,
  isBold,
  isItalics,
  isStrikethrough,
  isInlineCode,
  isLink,
  isShip,
  isBreak,
  isTask,
  isBlockquote,
  isBlockCode,
  isCode,
  isImage,
  isHeader,
  isListing,
  isList,
  isListItem,
  Bold,
  Italics,
  Strikethrough,
  InlineCode,
  Link,
  Ship,
  Break,
  Task,
  Blockquote,
  Code,
  Image,
  Header,
  ListingBlock,
  List,
  ListItem,
  Listing,
  Rule,
} from '@tloncorp/api/urbit/content';
import { Story, Verse, isBlockVerse } from '@tloncorp/api/urbit/channel';
import type { ShipMention } from './shipMentionPlugin';

/**
 * Check if a block is a Rule (horizontal rule).
 */
function isRule(block: Block): block is Rule {
  return 'rule' in block;
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
 * Convert Story Inline array to mdast phrasing content.
 */
export function inlinesToPhrasing(inlines: Inline[]): PhrasingContent[] {
  const merged = mergeAdjacentMarks(inlines);

  // Filter out trailing breaks - they mark paragraph boundaries, not hard line breaks
  let filtered = merged;
  while (filtered.length > 0 && isBreak(filtered[filtered.length - 1])) {
    filtered = filtered.slice(0, -1);
  }

  const result: PhrasingContent[] = [];

  for (const inline of filtered) {
    if (typeof inline === 'string') {
      const text: Text = { type: 'text', value: inline };
      result.push(text);
      continue;
    }

    if (isBold(inline)) {
      const bold = inline as Bold;
      const strong: Strong = {
        type: 'strong',
        children: inlinesToPhrasing(bold.bold),
      };
      result.push(strong);
      continue;
    }

    if (isItalics(inline)) {
      const italics = inline as Italics;
      const emphasis: Emphasis = {
        type: 'emphasis',
        children: inlinesToPhrasing(italics.italics),
      };
      result.push(emphasis);
      continue;
    }

    if (isStrikethrough(inline)) {
      const strike = inline as Strikethrough;
      const del: Delete = {
        type: 'delete',
        children: inlinesToPhrasing(strike.strike),
      };
      result.push(del);
      continue;
    }

    if (isInlineCode(inline)) {
      const code = inline as InlineCode;
      const inlineCode: MdastInlineCode = {
        type: 'inlineCode',
        value: code['inline-code'],
      };
      result.push(inlineCode);
      continue;
    }

    if (isLink(inline)) {
      const link = inline as Link;
      const mdastLink: MdastLink = {
        type: 'link',
        url: link.link.href,
        children: [{ type: 'text', value: link.link.content }],
      };
      result.push(mdastLink);
      continue;
    }

    if (isShip(inline)) {
      const ship = inline as Ship;
      // Use our custom ship mention node
      const shipMention: ShipMention = {
        type: 'shipMention',
        value: ship.ship,
      };
      result.push(shipMention as unknown as PhrasingContent);
      continue;
    }

    if (isBreak(inline)) {
      result.push({ type: 'break' });
      continue;
    }

    if (isTask(inline)) {
      // Task inlines are rendered as checkbox text using html to prevent escaping
      const task = inline as Task;
      const checkbox = task.task.checked ? '[x]' : '[ ]';
      const content = inlinesToPhrasing(task.task.content);
      result.push({ type: 'html', value: `${checkbox} ` } as unknown as PhrasingContent);
      result.push(...content);
      continue;
    }

    if (isBlockquote(inline)) {
      // Blockquote in inline context - render as HTML to prevent escaping
      // We need to preserve formatting, so we serialize the content to markdown first
      const bq = inline as Blockquote;
      const content = inlinesToPhrasing(bq.blockquote);
      const text = phrasingToMarkdown(content);
      const lines = text.split('\n');
      result.push({
        type: 'html',
        value: lines.map((line) => `> ${line}`).join('\n'),
      } as unknown as PhrasingContent);
      continue;
    }

    // Handle block code in inline context (from JSONToInlines with codeWithLang=false)
    if (isBlockCode(inline)) {
      const codeContent = (inline as { code: string }).code;
      result.push({ type: 'text', value: `\`\`\`\n${codeContent}\n\`\`\`` });
      continue;
    }

    // Handle Code block in inline context
    if (isCode(inline as unknown as Block)) {
      const code = inline as unknown as Code;
      const lang = code.code.lang || '';
      result.push({
        type: 'text',
        value: `\`\`\`${lang}\n${code.code.code}\n\`\`\``,
      });
      continue;
    }

    // Handle Image in inline context
    if (isImage(inline as unknown as Block)) {
      const image = inline as unknown as Image;
      const mdastImage: MdastImage = {
        type: 'image',
        url: image.image.src,
        alt: image.image.alt || undefined,
      };
      result.push(mdastImage);
      continue;
    }

    // Unknown inline type - skip
  }

  return result;
}

/**
 * Convert phrasing content to plain text (for simple cases).
 */
function phrasingToText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return (node as Text).value;
      if (node.type === 'break') return '\n';
      if ('children' in node) {
        return phrasingToText(node.children as PhrasingContent[]);
      }
      return '';
    })
    .join('');
}

/**
 * Convert phrasing content to markdown string (preserves formatting).
 */
function phrasingToMarkdown(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return (node as Text).value;
        case 'strong': {
          const inner = phrasingToMarkdown((node as Strong).children);
          return `**${inner}**`;
        }
        case 'emphasis': {
          const inner = phrasingToMarkdown((node as Emphasis).children);
          return `*${inner}*`;
        }
        case 'delete': {
          const inner = phrasingToMarkdown((node as Delete).children);
          return `~~${inner}~~`;
        }
        case 'inlineCode':
          return `\`${(node as MdastInlineCode).value}\``;
        case 'link': {
          const link = node as MdastLink;
          const content = phrasingToMarkdown(link.children);
          return `[${content}](${link.url})`;
        }
        case 'break':
          return '\n';
        case 'html':
          return (node as { value: string }).value;
        default:
          if ('children' in node) {
            return phrasingToMarkdown((node as { children: PhrasingContent[] }).children);
          }
          return '';
      }
    })
    .join('');
}

/**
 * Convert Story Listing to mdast ListItem array.
 */
function listingsToListItems(
  listings: Listing[],
  listType: 'ordered' | 'unordered' | 'tasklist'
): MdastListItem[] {
  const items: MdastListItem[] = [];

  for (const listing of listings) {
    if (isListItem(listing)) {
      const listItem = listing as ListItem;

      // Check if this is a task list item
      if (
        listType === 'tasklist' &&
        listItem.item.length > 0 &&
        isTask(listItem.item[0])
      ) {
        const task = listItem.item[0] as Task;
        const taskContent = inlinesToPhrasing(task.task.content);
        const mdastItem: MdastListItem = {
          type: 'listItem',
          checked: task.task.checked,
          children: [{ type: 'paragraph', children: taskContent }],
        };
        items.push(mdastItem);
      } else {
        // Split on breaks to create multiple paragraphs
        const paragraphs: Inline[][] = [];
        let currentParagraph: Inline[] = [];

        for (const inline of listItem.item) {
          if (isBreak(inline)) {
            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph);
              currentParagraph = [];
            }
          } else {
            currentParagraph.push(inline);
          }
        }

        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph);
        }

        // Convert each paragraph to mdast
        const mdastParagraphs = paragraphs
          .map((para) => inlinesToPhrasing(para))
          .filter((children) => children.length > 0)
          .map((children) => ({ type: 'paragraph' as const, children }));

        const mdastItem: MdastListItem = {
          type: 'listItem',
          children: mdastParagraphs,
        };
        items.push(mdastItem);
      }
    } else if (isList(listing)) {
      const list = listing as List;
      // Nested list - create parent item with contents and nested list
      const contentChildren = inlinesToPhrasing(list.list.contents);

      // Check if contents is a task
      const isOrdered = list.list.type === 'ordered';
      if (
        list.list.type === 'tasklist' &&
        list.list.contents.length > 0 &&
        isTask(list.list.contents[0])
      ) {
        const task = list.list.contents[0] as Task;
        const taskContent = inlinesToPhrasing(task.task.content);
        const nestedList: MdastList = {
          type: 'list',
          ordered: false, // task lists are unordered
          children: listingsToListItems(list.list.items, list.list.type),
        };
        const mdastItem: MdastListItem = {
          type: 'listItem',
          checked: task.task.checked,
          children: [{ type: 'paragraph', children: taskContent }, nestedList],
        };
        items.push(mdastItem);
      } else {
        const nestedList: MdastList = {
          type: 'list',
          ordered: isOrdered,
          children: listingsToListItems(list.list.items, list.list.type),
        };
        const mdastItem: MdastListItem = {
          type: 'listItem',
          children:
            contentChildren.length > 0
              ? [{ type: 'paragraph', children: contentChildren }, nestedList]
              : [nestedList],
        };
        items.push(mdastItem);
      }
    }
  }

  return items;
}

/**
 * Convert a Story Block to mdast RootContent.
 */
function blockToMdast(block: Block): RootContent | null {
  if (isHeader(block)) {
    const header = block as Header;
    const depth = parseInt(header.header.tag.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const children = inlinesToPhrasing(header.header.content);
    const heading: Heading = { type: 'heading', depth, children };
    return heading;
  }

  if (isCode(block)) {
    const code = block as Code;
    const mdastCode: MdastCode = {
      type: 'code',
      lang: code.code.lang || undefined,
      value: code.code.code,
    };
    return mdastCode;
  }

  if (isImage(block)) {
    const image = block as Image;
    // Wrap image in paragraph for standalone images
    const mdastImage: MdastImage = {
      type: 'image',
      url: image.image.src,
      alt: image.image.alt || undefined,
    };
    const paragraph: Paragraph = { type: 'paragraph', children: [mdastImage] };
    return paragraph;
  }

  if (isRule(block)) {
    const thematicBreak: ThematicBreak = { type: 'thematicBreak' };
    return thematicBreak;
  }

  if (isListing(block)) {
    const listingBlock = block as ListingBlock;
    const listing = listingBlock.listing;

    if (isList(listing)) {
      const list = listing as List;
      const mdastList: MdastList = {
        type: 'list',
        ordered: list.list.type === 'ordered',
        children: listingsToListItems(list.list.items, list.list.type),
      };
      return mdastList;
    } else if (isListItem(listing)) {
      // Single list item - wrap in list
      const mdastList: MdastList = {
        type: 'list',
        ordered: false,
        children: listingsToListItems([listing], 'unordered'),
      };
      return mdastList;
    }
  }

  // Unhandled block types (Cite, LinkBlock)
  return null;
}

/**
 * Convert a Story VerseInline to mdast content.
 * Returns an array because blockquotes in inline content need to be split into separate blocks.
 */
function verseInlineToMdast(inline: Inline[]): RootContent[] {
  const result: RootContent[] = [];
  let currentSegment: Inline[] = [];

  for (let i = 0; i < inline.length; i++) {
    const item = inline[i];

    if (isBlockquote(item)) {
      // Flush current segment as a paragraph if it has content
      if (currentSegment.length > 0) {
        const children = inlinesToPhrasing(currentSegment);
        if (children.length > 0) {
          result.push({ type: 'paragraph', children });
        }
        currentSegment = [];
      }

      // Add blockquote as a separate block
      const bq = item as Blockquote;
      const children = inlinesToPhrasing(bq.blockquote);
      const paragraph: Paragraph = { type: 'paragraph', children };
      const blockquote: MdastBlockquote = {
        type: 'blockquote',
        children: [paragraph],
      };
      result.push(blockquote);
    } else {
      // Skip breaks immediately before blockquotes (they're just separators)
      if (isBreak(item) && i + 1 < inline.length && isBlockquote(inline[i + 1])) {
        continue;
      }
      currentSegment.push(item);
    }
  }

  // Flush remaining segment
  if (currentSegment.length > 0) {
    const children = inlinesToPhrasing(currentSegment);
    if (children.length > 0) {
      result.push({ type: 'paragraph', children });
    }
  }

  return result;
}

/**
 * Convert Story (Verse[]) to mdast Root content array.
 */
export function storyToMdast(story: Story): RootContent[] {
  if (!story || story.length === 0) {
    return [];
  }

  const nodes: RootContent[] = [];

  for (const verse of story) {
    if (isBlockVerse(verse)) {
      const node = blockToMdast(verse.block);
      if (node) {
        nodes.push(node);
      }
    } else {
      // VerseInline - can return multiple nodes if it contains blockquotes
      const inlineNodes = verseInlineToMdast(verse.inline);
      nodes.push(...inlineNodes);
    }
  }

  return nodes;
}
