import {
  Story,
  Verse,
  VerseBlock,
  VerseInline,
} from '@tloncorp/api/urbit/channel';
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
  ListItem,
  Listing,
  ListingBlock,
  Rule,
  Sect,
  Ship,
  Strikethrough,
  Task,
} from '@tloncorp/api/urbit/content';
import type {
  Delete,
  Emphasis,
  Heading,
  Blockquote as MdastBlockquote,
  Code as MdastCode,
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

import type { GroupMention } from './groupMentionPlugin';
import type { ShipMention } from './shipMentionPlugin';

/**
 * Check if a node is a ship mention (custom node type from our plugin).
 */
function isShipMention(node: unknown): node is ShipMention {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'shipMention'
  );
}

/**
 * Check if a node is a group mention (custom node type from our plugin).
 */
function isGroupMention(node: unknown): node is GroupMention {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'groupMention'
  );
}

/**
 * Check if a node has a 'checked' property (GFM task list item).
 */
function isTaskListItem(
  node: MdastListItem
): node is MdastListItem & { checked: boolean } {
  return typeof node.checked === 'boolean';
}

/**
 * Convert mdast phrasing content (inline nodes) to Story Inline array.
 */
export function phrasingToInlines(nodes: PhrasingContent[]): Inline[] {
  const result: Inline[] = [];

  for (const node of nodes) {
    // Check for ship mention first (custom node type)
    if (isShipMention(node)) {
      const ship: Ship = { ship: (node as ShipMention).value };
      result.push(ship);
      continue;
    }

    // Group mentions: `@all` → { sect: null }, `@admin` → { sect: 'admin' }
    if (isGroupMention(node)) {
      const value = (node as GroupMention).value;
      const sect: Sect = { sect: value === 'all' ? null : value };
      result.push(sect);
      continue;
    }

    // Type assertion needed because TypeScript doesn't know about our custom node type
    const mdastNode = node as PhrasingContent;

    switch (mdastNode.type) {
      case 'text': {
        const text = mdastNode as Text;
        result.push(text.value);
        break;
      }

      case 'strong': {
        const strong = node as Strong;
        const inner = phrasingToInlines(strong.children);
        const bold: Bold = { bold: inner };
        result.push(bold);
        break;
      }

      case 'emphasis': {
        const emphasis = node as Emphasis;
        const inner = phrasingToInlines(emphasis.children);
        const italics: Italics = { italics: inner };
        result.push(italics);
        break;
      }

      case 'delete': {
        const del = node as Delete;
        const inner = phrasingToInlines(del.children);
        const strike: Strikethrough = { strike: inner };
        result.push(strike);
        break;
      }

      case 'inlineCode': {
        const code = node as MdastInlineCode;
        const inlineCode: InlineCode = { 'inline-code': code.value };
        result.push(inlineCode);
        break;
      }

      case 'link': {
        const link = node as MdastLink;
        // Extract text content from link children
        const content = link.children
          .map((child) => {
            if (child.type === 'text') return (child as Text).value;
            return '';
          })
          .join('');
        const linkInline: Link = {
          link: {
            href: link.url,
            content: content || link.url,
          },
        };
        result.push(linkInline);
        break;
      }

      case 'image': {
        // Inline images - convert to Image block (will be handled specially)
        const img = node as MdastImage;
        const image: Image = {
          image: {
            src: img.url,
            alt: img.alt || '',
            width: 0,
            height: 0,
          },
        };
        result.push(image as unknown as Inline);
        break;
      }

      case 'break': {
        const lineBreak: Break = { break: null };
        result.push(lineBreak);
        break;
      }

      default:
        // Skip unknown inline types (html, etc.)
        break;
    }
  }

  return result;
}

/**
 * Convert mdast list items to Story Listing array.
 */
function listItemsToListings(
  items: MdastListItem[],
  listType: 'ordered' | 'unordered' | 'tasklist'
): Listing[] {
  const listings: Listing[] = [];

  for (const item of items) {
    // Check for nested list
    const nestedListIndex = item.children.findIndex(
      (child) => child.type === 'list'
    );

    if (nestedListIndex >= 0) {
      // Has nested list - get content before nested list
      const contentNodes = item.children.slice(0, nestedListIndex);
      const nestedList = item.children[nestedListIndex] as MdastList;

      // Extract inlines from content nodes (usually a paragraph)
      let contentInlines: Inline[] = [];
      for (const contentNode of contentNodes) {
        if (contentNode.type === 'paragraph') {
          contentInlines = phrasingToInlines(
            (contentNode as Paragraph).children
          );
        }
      }

      // Handle task list with nested items
      if (listType === 'tasklist' && isTaskListItem(item)) {
        const task: Task = {
          task: { checked: item.checked, content: contentInlines },
        };
        contentInlines = [task];
      }

      // Convert nested list
      const nestedIsTaskList =
        nestedList.children.length > 0 &&
        typeof nestedList.children[0].checked === 'boolean';
      const nestedListType = nestedIsTaskList
        ? 'tasklist'
        : nestedList.ordered
          ? 'ordered'
          : 'unordered';

      const list: List = {
        list: {
          type: listType,
          contents: contentInlines,
          items: listItemsToListings(nestedList.children, nestedListType),
        },
      };
      listings.push(list);
    } else {
      // Simple list item - extract inline content from all paragraphs
      const inlines: Inline[] = [];

      for (const child of item.children) {
        if (child.type === 'paragraph') {
          const paragraphInlines = phrasingToInlines(
            (child as Paragraph).children
          );
          // Add the paragraph's content
          if (inlines.length > 0) {
            // Add a break between paragraphs to preserve paragraph separation
            inlines.push({ break: null });
          }
          inlines.push(...paragraphInlines);
        }
      }

      // Handle task list item
      if (listType === 'tasklist' && isTaskListItem(item)) {
        const task: Task = {
          task: { checked: item.checked, content: inlines },
        };
        const listItem: ListItem = { item: [task] };
        listings.push(listItem);
      } else {
        const listItem: ListItem = { item: inlines };
        listings.push(listItem);
      }
    }
  }

  return listings;
}

/**
 * Convert a mdast block node to a Story Block.
 */
function nodeToBlock(node: RootContent): Block | null {
  switch (node.type) {
    case 'heading': {
      const heading = node as Heading;
      const tag = `h${heading.depth}` as HeaderLevel;
      const content = phrasingToInlines(heading.children);
      const header: Header = { header: { tag, content } };
      return header;
    }

    case 'code': {
      const codeNode = node as MdastCode;
      // Normalize language to lowercase alphanumeric, default to 'text'
      const lang =
        codeNode.lang
          ?.trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '') || 'text';
      const code: Code = {
        code: {
          code: codeNode.value,
          lang,
        },
      };
      return code;
    }

    case 'thematicBreak': {
      const rule: Rule = { rule: null };
      return rule;
    }

    case 'list': {
      const list = node as MdastList;
      // Check if this is a task list by checking first item
      const isTaskList =
        list.children.length > 0 &&
        typeof list.children[0].checked === 'boolean';
      const listType = isTaskList
        ? 'tasklist'
        : list.ordered
          ? 'ordered'
          : 'unordered';

      const items = listItemsToListings(list.children, listType);

      const storyList: List = {
        list: {
          type: listType,
          contents: [],
          items,
        },
      };
      const listingBlock: ListingBlock = { listing: storyList };
      return listingBlock;
    }

    default:
      return null;
  }
}

/**
 * Convert a mdast paragraph to either a VerseInline or VerseBlock (for standalone images).
 */
function paragraphToVerse(paragraph: Paragraph): Verse | null {
  // Check if paragraph contains only a single image
  if (
    paragraph.children.length === 1 &&
    paragraph.children[0].type === 'image'
  ) {
    const img = paragraph.children[0] as MdastImage;
    const image: Image = {
      image: {
        src: img.url,
        alt: img.alt || '',
        width: 0,
        height: 0,
      },
    };
    const verseBlock: VerseBlock = { block: image };
    return verseBlock;
  }

  const inlines = phrasingToInlines(paragraph.children);
  if (inlines.length === 0) {
    return null;
  }

  const verseInline: VerseInline = { inline: inlines };
  return verseInline;
}

/**
 * Convert a mdast blockquote to a VerseInline with Blockquote inline.
 */
function blockquoteToVerse(blockquote: MdastBlockquote): VerseInline {
  const inlines: Inline[] = [];

  for (const child of blockquote.children) {
    if (child.type === 'paragraph') {
      inlines.push(...phrasingToInlines((child as Paragraph).children));
    }
  }

  const bq: Blockquote = { blockquote: inlines };
  return { inline: [bq] };
}

/**
 * Convert a mdast table to a VerseInline with text representation.
 * (Tables don't have a direct Story equivalent)
 */
function tableToVerse(node: RootContent): VerseInline | null {
  if (node.type !== 'table') return null;

  // Extract rows from table
  const rows: string[][] = [];
  for (const row of (
    node as {
      children: Array<{ children: Array<{ children: PhrasingContent[] }> }>;
    }
  ).children) {
    const cells: string[] = [];
    for (const cell of row.children) {
      // Extract text from cell children
      const text = cell.children
        .map((child: PhrasingContent) => {
          if (child.type === 'text') return (child as Text).value;
          return '';
        })
        .join('');
      cells.push(text);
    }
    rows.push(cells);
  }

  const tableText = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');
  return { inline: [tableText] };
}

/**
 * Convert mdast Root content to Story (Verse[]).
 */
export function mdastToStory(nodes: RootContent[]): Story {
  const verses: Verse[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph': {
        const verse = paragraphToVerse(node as Paragraph);
        if (verse) {
          verses.push(verse);
        }
        break;
      }

      case 'heading':
      case 'code':
      case 'thematicBreak':
      case 'list': {
        const block = nodeToBlock(node);
        if (block) {
          const verseBlock: VerseBlock = { block };
          verses.push(verseBlock);
        }
        break;
      }

      case 'blockquote': {
        const verse = blockquoteToVerse(node as MdastBlockquote);
        verses.push(verse);
        break;
      }

      case 'table': {
        const verse = tableToVerse(node);
        if (verse) {
          verses.push(verse);
        }
        break;
      }

      default:
        // Skip html, yaml frontmatter, etc.
        break;
    }
  }

  return verses;
}
