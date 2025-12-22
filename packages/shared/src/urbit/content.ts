import { UnionToIntersection } from '../utils';

type Flag = string;
type Nest = string;

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

export interface Sect {
  sect: string | null;
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
  | Sect
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
  | 'break'
  | 'ship'
  | 'task'
  | 'sect';

export function isInline(c: Inline | Block): c is Inline {
  if (typeof c === 'string') {
    return true;
  }

  if (typeof c !== 'object') {
    throw new Error('Invalid content type');
  }

  return (
    !isBlockLink(c) &&
    !isCode(c) &&
    [
      'text',
      'mention',
      'url',
      'color',
      'italics',
      'bold',
      'strike',
      'blockquote',
      'inline-code',
      'block',
      'code',
      'tag',
      'link',
      'break',
    ].some((k) => k in c)
  );
}

export interface ChanCite {
  chan: {
    nest: Nest;
    where: string;
  };
}

export interface GroupCite {
  group: Flag;
}

export interface DeskCite {
  desk: {
    flag: string;
    where: string;
  };
}

export interface BaitCite {
  bait: {
    group: Flag;
    graph: Flag;
    where: string;
  };
}

export type Cite = ChanCite | GroupCite | DeskCite | BaitCite;

export interface Image {
  image: {
    src: string;
    height: number;
    width: number;
    alt: string;
  };
}

export interface LinkBlock {
  link: {
    url: string;
    meta: Record<string, string | undefined> & {
      title?: string;
      description?: string;
      author?: string;
      siteName?: string;
      siteIcon?: string;
      previewImageUrl?: string;
      previewImageHeight?: string;
      previewImageWidth?: string;
    };
  };
}

export type ListType = 'ordered' | 'unordered' | 'tasklist';

export interface List {
  list: {
    type: 'ordered' | 'unordered' | 'tasklist';
    items: Listing[];
    contents: Inline[];
  };
}

export type ListItem = {
  item: Inline[];
};

export type Listing = List | ListItem;

export interface ListingBlock {
  listing: Listing;
}

export type HeaderLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface Header {
  header: {
    tag: HeaderLevel;
    content: Inline[];
  };
}

export interface Rule {
  rule: null;
}

export interface Code {
  code: {
    code: string;
    lang: string;
  };
}

export type Block =
  | Image
  | { cite: Cite }
  | ListingBlock
  | Header
  | Rule
  | Code
  | LinkBlock;

export namespace Block {
  export function is<K extends keyof UnionToIntersection<Block>>(
    poly: Block,
    type: K
  ): // @ts-expect-error - hey, I'm asserting here!
  poly is Pick<UnionToIntersection<Block>, K> {
    if (type === 'link') {
      return isBlockLink(poly);
    }

    return type in poly;
  }
}

export function isBlock(c: Inline | Block): c is Block {
  if (typeof c === 'string') {
    return false;
  }

  if (typeof c !== 'object') {
    throw new Error('Invalid content type');
  }

  return (
    !isLink(c) &&
    !isBlockCode(c) &&
    [
      'cite',
      'link',
      'image',
      'listing',
      'header',
      'rule',
      'code',
      'chan',
      'desk',
      'bait',
      'group',
    ].some((k) => k in c)
  );
}

export function isBold(item: unknown): item is Bold {
  return typeof item === 'object' && item !== null && 'bold' in item;
}

export function isItalics(item: unknown): item is Italics {
  return typeof item === 'object' && item !== null && 'italics' in item;
}

export function isLink(item: unknown): item is Link {
  return (
    typeof item === 'object' &&
    item !== null &&
    'link' in item &&
    'href' in (item as Link).link
  );
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
  return (
    typeof item === 'object' &&
    item !== null &&
    'code' in item &&
    typeof item.code === 'string'
  );
}

export function isBreak(item: unknown): item is Break {
  return typeof item === 'object' && item !== null && 'break' in item;
}

export function isShip(item: unknown): item is Ship {
  return typeof item === 'object' && item !== null && 'ship' in item;
}

export function isSect(item: unknown): item is Sect {
  return typeof item === 'object' && item !== null && 'sect' in item;
}

export function isHeader(block: Block): block is Header {
  return 'header' in block;
}

export function isCode(item: unknown): item is Code {
  return (
    typeof item === 'object' &&
    item !== null &&
    'code' in item &&
    typeof item.code === 'object'
  );
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

export function isImage(item: unknown): item is Image {
  return typeof item === 'object' && item !== null && 'image' in item;
}

export function isBlockLink(item: unknown): item is LinkBlock {
  return (
    typeof item === 'object' &&
    item !== null &&
    'link' in item &&
    'url' in (item as LinkBlock).link
  );
}

export function isCite(s: Block): boolean {
  if ('cite' in s) {
    return true;
  }
  return false;
}
