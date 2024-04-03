import {
  Block,
  Code,
  Header,
  List,
  ListItem,
  Listing,
  ListingBlock,
  Verse,
  VerseBlock,
} from './channel';

export type JSONContent = {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: {
    type: string;
    attrs?: Record<string, any>;
    [key: string]: any;
  }[];
  text?: string;
  [key: string]: any;
};

export interface Ship {
  ship: string;
}

export interface Italics {
  italics: Inline[];
}

export interface Bold {
  bold: Inline[];
}

export interface Strikethrough {
  strike: Inline[];
}

export interface Break {
  break: null;
}

export interface InlineCode {
  'inline-code': string;
}

export interface BlockCode {
  code: string;
}

export interface Blockquote {
  blockquote: Inline[];
}

/**
 A reference to the accompanying blocks, indexed at 0
*/
export interface BlockReference {
  block: {
    index: number;
    text: string;
  };
}

export interface Tag {
  tag: string;
}

export interface Link {
  link: {
    href: string;
    content: string;
  };
}

export interface Task {
  task: {
    checked: boolean;
    content: Inline[];
  };
}

export type Inline =
  | string
  | Bold
  | Italics
  | Strikethrough
  | Ship
  | Break
  | InlineCode
  | BlockCode
  | Blockquote
  | BlockReference
  | Tag
  | Link
  | Task;

export type InlineKey =
  | 'italics'
  | 'bold'
  | 'strike'
  | 'blockquote'
  | 'inline-code'
  | 'block'
  | 'code'
  | 'tag'
  | 'link'
  | 'break';

export function isBlock(verse: Verse): verse is VerseBlock {
  return 'block' in verse;
}

export function isBold(item: unknown): item is Bold {
  return typeof item === 'object' && item !== null && 'bold' in item;
}

export function isItalics(item: unknown): item is Italics {
  return typeof item === 'object' && item !== null && 'italics' in item;
}

export function isLink(item: unknown): item is Link {
  return typeof item === 'object' && item !== null && 'link' in item;
}

export function isStrikethrough(item: unknown): item is Strikethrough {
  return typeof item === 'object' && item !== null && 'strike' in item;
}

export function isBlockquote(item: unknown): item is Blockquote {
  return typeof item === 'object' && item !== null && 'blockquote' in item;
}

export function isInlineCode(item: unknown): item is InlineCode {
  return typeof item === 'object' && item !== null && 'inline-code' in item;
}

export function isBlockCode(item: unknown): item is BlockCode {
  return typeof item === 'object' && item !== null && 'code' in item;
}

export function isBreak(item: unknown): item is Break {
  return typeof item === 'object' && item !== null && 'break' in item;
}

export function isShip(item: unknown): item is Ship {
  return typeof item === 'object' && item !== null && 'ship' in item;
}

export function isHeader(block: Block): block is Header {
  return 'header' in block;
}

export function isCode(block: Block): block is Code {
  return 'code' in block;
}

export function isListing(block: Block): block is ListingBlock {
  return 'listing' in block;
}

export function isListItem(listing: Listing): listing is ListItem {
  return 'item' in listing;
}

export function isList(listing: Listing): listing is List {
  return 'list' in listing;
}

export function isTag(item: unknown): item is Tag {
  return typeof item === 'object' && item !== null && 'tag' in item;
}

export function isBlockReference(item: unknown): item is BlockReference {
  return typeof item === 'object' && item !== null && 'block' in item;
}

export function isTask(item: unknown): item is Task {
  return typeof item === 'object' && item !== null && 'task' in item;
}
