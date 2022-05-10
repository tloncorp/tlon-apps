import { BigIntOrderedMap } from '@urbit/api';

export type Patda = string;
export type Ship = string;

type ChatBlock = unknown;

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

export function isBold(item: unknown): item is Bold {
  return typeof item === 'object' && item !== null && 'bold' in item;
}

export function isItalics(item: unknown): item is Italics {
  return typeof item === 'object' && item !== null && 'italics' in item;
}

export function isLink(item: unknown): item is Link {
  return typeof item === 'object' && item !== null && 'href' in item;
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
  replied: string[];
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

interface ChatDiffAddSects {
  'add-sects': string[];
}

export type ChatDiff =
  | ChatDiffAdd
  | ChatDiffDel
  | ChatDiffAddFeel
  | ChatDiffAddSects;

export interface ChatUpdate {
  time: Patda;
  diff: ChatDiff;
}
export interface ChatPerm {
  writers: string[];
}

export interface Chat {
  writs: BigIntOrderedMap<ChatWrit>;
  perms: ChatPerm;
}
