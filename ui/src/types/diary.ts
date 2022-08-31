import { BigIntOrderedMap } from '@urbit/api';
import {
  BlockCode,
  Blockquote,
  BlockReference,
  Bold,
  Break,
  Inline,
  InlineCode,
  Italics,
  Link,
  Strikethrough,
  Tag,
} from './content';

export type Patda = string;
export type Ship = string;

export type DiaryInline =
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
  | Link;

export interface NoteSeal {
  time: string;
  feels: {
    [ship: Ship]: string;
  };
}

export interface VerseInline {
  inline: DiaryInline[];
}

export interface DiaryImage {
  image: {
    src: string;
    height: number;
    width: number;
    alt: string;
  };
}

export function isDiaryImage(item: unknown): item is DiaryImage {
  return typeof item === 'object' && item !== null && 'image' in item;
}

export type DiaryBlock = DiaryImage;

export interface VerseBlock {
  block: DiaryBlock;
}

export type Verse = VerseInline | VerseBlock;

export type NoteContent = Verse[];

export interface NoteEssay {
  title: string;
  image: string;
  content: NoteContent;
  author: Ship;
  sent: number;
}

export interface DiaryNote {
  seal: NoteSeal;
  essay: NoteEssay;
}

export interface DiaryNotes {
  [time: string]: DiaryNote;
}

export type DiaryNoteMap = BigIntOrderedMap<DiaryNote>;

export interface DiaryQuip {
  seal: NoteSeal;
  memo: DiaryMemo;
}

export interface DiaryMemo {
  replying: string;
  content: Inline[];
  author: string;
  sent: number;
}

export type DiaryQuipMap = BigIntOrderedMap<DiaryQuip>;

export interface DiaryQuips {
  [id: string]: DiaryQuip;
}

interface NoteDeltaAdd {
  add: NoteEssay;
}

interface NoteDeltaDel {
  del: null;
}

interface NoteDeltaAddFeel {
  'add-feel': {
    time: string;
    feel: string;
    ship: string;
  };
}

interface DiaryDiffAddSects {
  'add-sects': string[];
}

interface DiaryDiffDelSects {
  'del-sects': string[];
}

interface DiaryDiffQuips {
  quips: {
    id: string;
    diff: QuipDiff;
  };
}

export type NoteDelta = NoteDeltaAdd | NoteDeltaDel | NoteDeltaAddFeel;

export interface NoteDiff {
  time: string;
  delta: NoteDelta;
}

export type DiaryDiff =
  | { notes: NoteDiff }
  | DiaryDiffAddSects
  | DiaryDiffDelSects
  | DiaryDiffQuips;

export interface DiaryUpdate {
  time: string;
  diff: DiaryDiff;
}

export interface DiaryAction {
  flag: string;
  update: DiaryUpdate;
}

export interface QuipDeltaAdd {
  add: DiaryMemo;
}

export interface QuipDeltaDel {
  del: null;
}

export interface QuipDeltaAddFeel {
  'add-feel': {
    ship: string;
    feel: string;
  };
}

export interface QuipDeltaDelFeel {
  'del-feel': string;
}

export type QuipDelta =
  | QuipDeltaAdd
  | QuipDeltaDel
  | QuipDeltaAddFeel
  | QuipDeltaDelFeel;

export interface QuipDiff {
  time: string;
  delta: QuipDelta;
}

export type DiaryDisplayMode = 'list' | 'grid';

export interface Diary {
  perms: DiaryPerm;
}

export interface Shelf {
  [key: string]: Diary;
}

export interface DiaryBrief {
  last: number;
  count: number;
  'read-id': string | null;
}

export interface DiaryBriefs {
  [flag: DiaryFlag]: DiaryBrief;
}

export interface DiaryBriefUpdate {
  flag: DiaryFlag;
  brief: DiaryBrief;
}

/**
 * `@p`/{name}
 */
export type DiaryFlag = string;

export interface DiaryCreate {
  group: string;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface DiaryPerm {
  writers: string[];
}
