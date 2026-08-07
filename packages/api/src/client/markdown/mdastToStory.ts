import type {
  BlockContent,
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
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { Node } from 'unist';

import { assertNever } from '../../lib/assertNever';
import { Story, Verse, VerseBlock, VerseInline } from '../../urbit/channel';
import {
  Block,
  BlockCode,
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
} from '../../urbit/content';
import type { GroupMention } from './groupMentionPlugin';
import { separateShipMentionsFromFusableSiblings } from './serialize';
import type { ShipMention } from './shipMentionPlugin';

const tableMentionHandlers = {
  handlers: {
    shipMention(node: { value: string }) {
      return node.value;
    },
    groupMention(node: { value: string }) {
      return `@${node.value}`;
    },
  },
} as unknown as NonNullable<Parameters<typeof toMarkdown>[1]>;

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
 * Flatten mdast link-label children to Story's string-only link content.
 * Formatting contributes its visible text; ship mention values already carry
 * their sigil, while group mention values restore their `@`.
 */
function linkLabelToText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if (isShipMention(node)) {
        return (node as unknown as ShipMention).value;
      }
      if (isGroupMention(node)) {
        return `@${(node as unknown as GroupMention).value}`;
      }

      switch (node.type) {
        case 'text':
        case 'inlineCode':
          return node.value;
        // remark parses inline HTML inside a label as `html` nodes holding the
        // raw tags, with the visible text as a sibling `text` node. Emitting
        // `node.value` here would put `<span>label</span>` in the link rather
        // than `label`. Story link content is a plain string with nowhere to
        // put markup, and inline HTML is skipped everywhere else in this
        // converter, so drop the tags and keep the sibling text.
        case 'html':
          return '';
        case 'break':
          return '\n';
        case 'image':
          return node.alt ?? '';
        default:
          if ('children' in node) {
            return linkLabelToText(node.children as PhrasingContent[]);
          }
          return '';
      }
    })
    .join('');
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
 * Classify a list from all of its items. GFM permits task and plain items in
 * the same list, so the list is a task list when any item has checkbox state.
 */
function getListType(list: MdastList): 'ordered' | 'unordered' | 'tasklist' {
  if (list.children.some(isTaskListItem)) {
    return 'tasklist';
  }
  return list.ordered ? 'ordered' : 'unordered';
}

function blockContentToMarkdown(node: BlockContent): string {
  // A mention adjacent to text would fuse into a different ship when this
  // fragment is reserialized and reparsed, so separate them first.
  separateShipMentionsFromFusableSiblings(node as unknown as Node);
  return toMarkdown(node as Parameters<typeof toMarkdown>[0], {
    extensions: [
      gfmToMarkdown({
        // Keep GFM table alignment delimiters parseable in the fallback text.
        stringLength: (value) => Math.max(value.length, 4),
      }),
      tableMentionHandlers,
    ],
  }).trimEnd();
}

/**
 * Convert block-capable mdast children into Story's inline representation.
 * Nested blockquotes and code blocks use the legal inline `%blockquote` and
 * `%code` arms. Block-only children fall back to visible Markdown because
 * Story list and blockquote content cannot contain Blocks.
 */
function blockChildrenToInlines(
  children: MdastBlockquote['children'] | MdastListItem['children']
): Inline[] {
  const inlines: Inline[] = [];

  for (const child of children) {
    let blockInlines: Inline[];

    switch (child.type) {
      case 'paragraph': {
        blockInlines = phrasingToInlines((child as Paragraph).children);
        break;
      }

      case 'blockquote': {
        const blockquote: Blockquote = {
          blockquote: blockChildrenToInlines(
            (child as MdastBlockquote).children
          ),
        };
        blockInlines = [blockquote];
        break;
      }

      case 'code': {
        const codeNode = child as MdastCode;
        const code: BlockCode =
          codeNode.lang && codeNode.lang !== 'text'
            ? ({
                code: { code: codeNode.value, lang: codeNode.lang },
              } as unknown as BlockCode)
            : { code: codeNode.value };
        blockInlines = [code];
        break;
      }

      case 'heading':
      case 'html':
      case 'list':
      case 'table':
      case 'thematicBreak': {
        blockInlines = [blockContentToMarkdown(child)];
        break;
      }

      // Reference definitions and footnotes are deliberately outside this
      // round's scope. Keep their existing behavior isolated from the
      // exhaustive BlockContent conversion above.
      case 'definition':
      case 'footnoteDefinition':
        continue;

      default: {
        blockInlines = assertNever(child);
        break;
      }
    }

    if (blockInlines.length === 0) {
      continue;
    }
    if (inlines.length > 0) {
      inlines.push({ break: null });
    }
    inlines.push(...blockInlines);
  }

  return inlines;
}

/**
 * Convert mdast phrasing content (inline nodes) to Story Inline array.
 */
export function phrasingToInlines(nodes: PhrasingContent[]): Inline[] {
  const result: Inline[] = [];

  for (const node of nodes) {
    // Check for ship mention first (custom node type)
    if (isShipMention(node)) {
      const ship: Ship = {
        ship: (node as unknown as ShipMention).value,
      };
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
        const content = linkLabelToText(link.children);
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

      let contentInlines = blockChildrenToInlines(contentNodes);

      // Handle task list with nested items
      if (listType === 'tasklist' && isTaskListItem(item)) {
        const task: Task = {
          task: { checked: item.checked, content: contentInlines },
        };
        contentInlines = [task];
      }

      // Convert nested list
      const nestedListType = getListType(nestedList);

      const list: List = {
        list: {
          type: nestedListType,
          contents: contentInlines,
          items: listItemsToListings(nestedList.children, nestedListType),
        },
      };
      listings.push(list);
    } else {
      const inlines = blockChildrenToInlines(item.children);

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
      const listType = getListType(list);

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
  const bq: Blockquote = {
    blockquote: blockChildrenToInlines(blockquote.children),
  };
  return { inline: [bq] };
}

/**
 * Convert a mdast table to a VerseInline with text representation.
 * (Tables don't have a direct Story equivalent)
 */
function tableToVerse(node: RootContent): VerseInline | null {
  if (node.type !== 'table') return null;

  // A mention adjacent to text in a cell would fuse into a different ship
  // when the table is reserialized and reparsed, so separate them first.
  separateShipMentionsFromFusableSiblings(node);
  const tableText = toMarkdown(node as Parameters<typeof toMarkdown>[0], {
    extensions: [
      gfmToMarkdown({
        // Keep alignment delimiters parseable by remark-gfm after serialization.
        stringLength: (value) => Math.max(value.length, 4),
      }),
      tableMentionHandlers,
    ],
  }).trimEnd();
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
