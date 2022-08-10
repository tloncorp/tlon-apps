import { BigIntOrderedMap } from '@urbit/api';
import {
  BlockCode,
  Blockquote,
  BlockReference,
  Bold,
  Break,
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
  time: number;
  feels: {
    [ship: Ship]: string;
  };
}

export interface VerseInline {
  inline: DiaryInline[];
}

export interface VerseBlock {
  block: null;
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

export type NoteDelta = NoteDeltaAdd | NoteDeltaDel | NoteDeltaAddFeel;

export interface NoteDiff {
  time: number;
  delta: NoteDelta;
}

export type DiaryDiff =
  | { notes: NoteDiff }
  | DiaryDiffAddSects
  | DiaryDiffDelSects;

export interface DiaryUpdate {
  time: number;
  diff: DiaryDiff;
}

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
