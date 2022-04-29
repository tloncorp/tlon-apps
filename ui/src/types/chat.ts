export type Patda = string;
export type Ship = string;

type ChatBlock = any;

interface Italics {
  italics: string;
}


interface Bold {
  bold: string;
}

/**
 A reference to the accompanying blocks, indexed at 0
*/
interface BlockReference {
  block: {
    index: number;
    text: string;
  };
}

interface InlineCode {
  'inline-code': string;
}

interface BlockCode {
  code: string;
}

interface Blockquote {
  blockquote: string;
}

interface Tag {
  tag: string;
}

interface Link {
  href: string;
}

type ChatInline =
  | string
  | Bold
  | Italics
  | Ship
  | BlockReference
  | InlineCode
  | BlockCode
  | Blockquote
  | Tag
  | Link;

export function isBold(item: any): item is Bold {
  return !!item.bold && typeof item.bold === 'string';
}

export function isItalics(item: any): item is Italics {
  return !!item.italics && typeof item.italics === 'string';
}

export function isLink(item: any): item is Link {
  return !!item.href && typeof item.href === 'string';
}

export interface ChatMessage {
  block: ChatBlock[];
  inline: ChatInline[];
}

export interface ChatSeal {
  time: Patda;
  feels: {
    [ship: Ship]: string;
  };
}

export interface ChatMemo {
  replying: Patda | null;
  author: Ship;
  sent: number;
  content: ChatMessage;
}

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

export type ChatWrits = {
  time: Patda;
  writ: ChatWrit;
}[];

interface ChatDiffAdd {
  add: ChatMemo;
}

interface ChatDiffDel {
  del: string;
}

interface ChatDiffAddFeel {
  'add-feel': {
    time: string;
    feel: string;
    ship: string;
  };
}

export type ChatDiff = ChatDiffAdd | ChatDiffDel | ChatDiffAddFeel;

export interface ChatUpdate {
  time: Patda;
  diff: ChatDiff;
}
