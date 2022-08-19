import { BigIntOrderedMap } from '@urbit/api';
import {
  Italics,
  Strikethrough,
  Break,
  InlineCode,
  BlockCode,
  Bold,
  Blockquote,
  Link,
  Tag,
} from './content';

export type Patda = string;
export type Ship = string;

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

export type HeapInlineKey =
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
  time: string;
  feels: {
    [ship: Ship]: string;
  };
  replied: string[];
}

export type CurioContent = HeapInline[];

export interface CurioHeart {
  title: string | null;
  content: CurioContent;
  author: Ship;
  sent: number;
  replying: string | null;
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
  time: string;
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
  perms: HeapPerm;
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

export interface HeapCreate {
  group: string;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface HeapPerm {
  writers: string[];
}
