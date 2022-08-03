import { BigIntOrderedMap } from '@urbit/api';
import { ChannelPerm } from './channel';

export type Patda = string;
export type Ship = string;

export interface Italics {
  italics: HeapInline;
}

export interface Bold {
  bold: HeapInline;
}

export interface Strikethrough {
  strike: HeapInline;
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
  blockquote: HeapInline[];
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

export type HeapInline =
  | string
  | Bold
  | Italics
  | Strikethrough
  | Ship
  | Break
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

export function isBreak(item: unknown): item is Break {
  return typeof item === 'object' && item !== null && 'break' in item;
}

export interface CurioSeal {
  time: number;
  feels: {
    [ship: Ship]: string;
  };
  replied: number[];
}

export type CurioContent = HeapInline[];

export interface CurioHeart {
  title: string | null;
  content: CurioContent;
  author: Ship;
  sent: number;
  replying: number | null;
}

export interface HeapCurio {
  seal: CurioSeal;
  heart: CurioHeart;
}

export interface HeapCurios {
  [time: string]: HeapCurio;
}

export type HeapCurioMap = BigIntOrderedMap<HeapCurio>;

interface CurioDeltaAdd {
  add: CurioHeart;
}

interface CurioDeltaDel {
  del: null;
}

interface CurioDeltaAddFeel {
  'add-feel': {
    time: string;
    feel: string;
    ship: string;
  };
}

interface HeapDiffAddSects {
  'add-sects': string[];
}

interface HeapDiffDelSects {
  'del-sects': string[];
}

export type CurioDelta = CurioDeltaAdd | CurioDeltaDel | CurioDeltaAddFeel;

export interface CurioDiff {
  time: number;
  delta: CurioDelta;
}

export type HeapDiff =
  | { curios: CurioDiff }
  | HeapDiffAddSects
  | HeapDiffDelSects;

export interface HeapUpdate {
  time: number;
  diff: HeapDiff;
}

export interface Heap {
  perms: ChannelPerm;
}

export interface Stash {
  [key: string]: Heap;
}

export interface HeapBrief {
  last: number;
  count: number;
  'read-id': string | null;
}

export interface HeapBriefs {
  [flag: HeapFlag]: HeapBrief;
}

export interface HeapBriefUpdate {
  flag: HeapFlag;
  brief: HeapBrief;
}

/**
 * `@p`/{name}
 */
export type HeapFlag = string;
