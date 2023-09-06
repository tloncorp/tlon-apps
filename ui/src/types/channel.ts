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
  Ship as ShipInline,
  Strikethrough,
  Tag,
} from './content';
import { Flag } from './hark';
import { Saga } from './groups';

export type Patda = string;
export type Ship = string;

export type DiaryInline =
  | string
  | Bold
  | Italics
  | Strikethrough
  | ShipInline
  | Break
  | InlineCode
  | BlockCode
  | Blockquote
  | BlockReference
  | Tag
  | Link;

export interface NoteSeal {
  id: string;
  quips: DiaryQuipMap;
  feels: {
    [ship: Ship]: string;
  };
}

export interface QuipCork {
  id: string;
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

export interface BaitCite {
  bait: {
    group: string;
    graph: string;
    where: string;
  };
}

export type Cite = ChanCite | GroupCite | DeskCite | BaitCite;

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
    content: Inline[];
  };
}

export interface DiaryRule {
  rule: null;
}

export interface DiaryCode {
  code: {
    code: string;
    lang: string;
  };
}

export function isDiaryImage(item: unknown): item is DiaryImage {
  return typeof item === 'object' && item !== null && 'image' in item;
}

export type DiaryBlock =
  | DiaryImage
  | DiaryCite
  | DiaryListingBlock
  | DiaryHeader
  | DiaryRule
  | DiaryCode;

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
  type: 'note';
  seal: NoteSeal;
  essay: NoteEssay;
}

export interface DiaryOutline extends NoteEssay {
  type: 'outline';
  quipCount: number;
  quippers: Ship[];
}

export interface DiaryOutlines {
  [time: string]: DiaryOutline;
}

export type DiaryOutlinesMap = BigIntOrderedMap<DiaryOutline>;

export type DiaryNoteMap = BigIntOrderedMap<DiaryNote>;

export interface DiaryQuip {
  cork: QuipCork;
  memo: DiaryMemo;
}

export interface DiaryStory {
  block: DiaryBlock[];
  inline: Inline[];
}

export interface DiaryMemo {
  content: DiaryStory;
  author: string;
  sent: number;
}

export type DiaryQuipMap = BigIntOrderedMap<DiaryQuip>;

export interface DiaryQuips {
  [id: string]: DiaryQuip;
}

interface NoteActionAdd {
  add: NoteEssay;
}

interface NoteActionEdit {
  edit: {
    id: string;
    essay: NoteEssay;
  };
}

interface NoteActionDel {
  del: string;
}

interface NoteActionAddFeel {
  'add-feel': {
    id: string;
    feel: string;
    ship: string;
  };
}

interface NoteActionDelFeel {
  'del-feel': {
    id: string;
    ship: string;
  };
}

interface DiaryDiffAddWriters {
  'add-writers': string[];
}

interface DiaryDiffDelWriters {
  'del-writers': string[];
}

interface DiaryDiffArrangedNotes {
  order: string[];
}

interface DiaryDiffSort {
  sort: DiarySortMode;
}

interface NoteActionQuip {
  quip: {
    id: string; // note id
    action: QuipAction;
  };
}

export interface NoteDiff {
  id: string;
  command: NoteAction;
}

export type NoteAction =
  | NoteActionAdd
  | NoteActionEdit
  | NoteActionDel
  | NoteActionAddFeel
  | NoteActionDelFeel
  | NoteActionQuip;

export interface DiaryDiffView {
  view: DiaryDisplayMode;
}

export interface DiaryCreateDiff {
  create: {
    perm: DiaryPerm;
    notes: DiaryNoteMap;
  };
}

export interface QuipActionAdd {
  add: DiaryMemo;
}

export interface QuipActionDel {
  del: string;
}

export interface QuipActionAddFeel {
  'add-feel': {
    id: string;
    ship: string;
    feel: string;
  };
}

export interface QuipActionDelFeel {
  'del-feel': {
    id: string;
    ship: string;
  };
}

export type QuipAction =
  | QuipActionAdd
  | QuipActionDel
  | QuipActionAddFeel
  | QuipActionDelFeel;

export type DiaryDisplayMode = 'list' | 'grid';

export type DiarySortMode = 'alpha' | 'time' | 'arranged';

export interface Diary {
  perms: DiaryPerm;
  view: DiaryDisplayMode;
  order: string[];
  sort: DiarySortMode;
  saga: Saga | null;
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
  group: Flag;
}

export interface DiarySaid {
  flag: string;
  outline: DiaryOutline;
}

export interface DiaryInit {
  briefs: DiaryBriefs;
  shelf: Shelf;
}

export type DiaryDiff = DiaryCreateDiff | DiaryCommand;

export type DiaryAction =
  | { join: string } // group flag
  | { leave: null }
  | { read: null }
  | { 'read-at': string }
  | { watch: null }
  | { unwatch: null }
  | DiaryCommand;

export type DiaryShelfAction =
  | { diary: { flag: DiaryFlag; action: DiaryAction } }
  | { create: DiaryCreate };

export type DiaryCommand =
  | { note: NoteAction }
  | DiaryDiffView
  | DiaryDiffAddWriters
  | DiaryDiffDelWriters
  | DiaryDiffArrangedNotes
  | DiaryDiffSort;

export type DiaryResponse =
  | { notes: DiaryNoteMap }
  | { note: NoteDiff }
  | { order: string[] }
  | { view: DiaryDisplayMode }
  | { sort: DiarySortMode }
  | { perm: DiaryPerm }
  | { create: DiaryPerm }
  | { join: string }
  | { leave: null }
  | { read: null }
  | { 'read-at': string }
  | { watch: null }
  | { unwatch: null };

export interface DiaryShelfResponse {
  flag: DiaryFlag;
  response: DiaryResponse;
}
