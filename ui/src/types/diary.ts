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

export interface ChanCite {
  chan: {
    nest: string;
    where: string;
  };
}

export interface GroupCite {
  group: string;
}

export interface DeskCite {
  desk: {
    flag: string;
    where: string;
  };
}

export type Cite = ChanCite | GroupCite | DeskCite;

export interface DiaryCite {
  cite: Cite;
}

export interface DiaryImage {
  image: {
    src: string;
    height: number;
    width: number;
    alt: string;
  };
}

export interface DiaryList {
  list: {
    type: 'ordered' | 'unordered';
    items: DiaryListing[];
    contents: Inline[];
  };
}

export type DiaryListItem = {
  item: Inline[];
};

export type DiaryListing = DiaryList | DiaryListItem;

export interface DiaryListingBlock {
  listing: DiaryListing;
}

export type DiaryHeaderLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface DiaryHeader {
  header: {
    tag: DiaryHeaderLevel;
    content: Inline;
  };
}

export interface DiaryRule {
  rule: null;
}

export function isDiaryImage(item: unknown): item is DiaryImage {
  return typeof item === 'object' && item !== null && 'image' in item;
}

export type DiaryBlock =
  | DiaryImage
  | DiaryCite
  | DiaryListingBlock
  | DiaryHeader
  | DiaryRule;

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

interface NoteDeltaEdit {
  edit: NoteEssay;
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

export type NoteDelta =
  | NoteDeltaAdd
  | NoteDeltaEdit
  | NoteDeltaDel
  | NoteDeltaAddFeel;

export interface NoteDiff {
  time: string;
  delta: NoteDelta;
}

export interface DiaryDiffView {
  view: DiaryDisplayMode;
}

export type DiaryDiff =
  | { notes: NoteDiff }
  | DiaryDiffView
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
  view: DiaryDisplayMode;
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
