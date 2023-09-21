import _ from 'lodash';
import { BigInteger } from 'big-integer';
import BTree from 'sorted-btree';
import { Inline, isLink, Link } from './content';
import { Flag } from './hark';
import { Saga } from './groups';
import { ChatBlock, ChatStory } from './dms';

export type Patda = string;
export type Ship = string;
export type Nest = string;

export interface QuipMeta {
  quipCount: number;
  lastQuippers: Ship[];
  lastQuip: string | null;
}

export interface NoteSeal {
  id: string;
  feels: { [ship: Ship]: string };
  quips: QuipMap | null;
  meta: QuipMeta;
}

export interface QuipCork {
  id: string;
  feels: {
    [ship: Ship]: string;
  };
}

export interface VerseInline {
  inline: Inline[];
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

export function isImage(item: unknown): item is Image {
  return typeof item === 'object' && item !== null && 'image' in item;
}

export type Block =
  | Image
  | { cite: Cite }
  | ListingBlock
  | Header
  | Rule
  | Code;

export interface VerseBlock {
  block: Block;
}

export type Verse = VerseInline | VerseBlock;

export type Story = Verse[];

export type HanHeap = {
  heap: string;
};

export type HanDiary = {
  diary: {
    title: string;
    image?: string;
  };
};

export type HanChat = {
  chat: null | { notice: null };
};

export type HanData = HanDiary | HanChat | HanHeap;
export type Han = 'heap' | 'diary' | 'chat';

export interface NoteEssay {
  content: Story;
  author: Ship;
  sent: number;
  'han-data': HanData;
}

export type Note = {
  seal: NoteSeal;
  essay: NoteEssay;
};

export interface Notes {
  [time: string]: Note | null;
}

export type NoteTuple = [BigInteger, Note | null];

export type NoteMap = BTree<BigInteger, Note | null>;

export interface Quip {
  cork: QuipCork;
  memo: Memo;
}

export interface Memo {
  content: Story;
  author: Ship;
  sent: number;
}

export type QuipMap = BTree<BigInteger, Quip>;

export interface Quips {
  [id: string]: Quip;
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

interface DiffAddWriters {
  'add-writers': string[];
}

interface DiffDelWriters {
  'del-writers': string[];
}

interface DiffArrangedNotes {
  order: string[];
}

interface DiffSort {
  sort: SortMode;
}

interface NoteActionQuip {
  quip: {
    id: string; // note id
    action: QuipAction;
  };
}

// export interface NoteCommand {
// set: null | Note;
// quip: Quip;

// export interface NoteDiff {
// id: string;
// command: NoteAction;
// }

export type NoteAction =
  | NoteActionAdd
  | NoteActionEdit
  | NoteActionDel
  | NoteActionAddFeel
  | NoteActionDelFeel
  | NoteActionQuip;

export interface DiffView {
  view: DisplayMode;
}

export interface CreateDiff {
  create: {
    perm: Perm;
    notes: NoteMap;
  };
}

export interface QuipActionAdd {
  add: Memo;
}

export interface QuipActionDel {
  del: string;
}

export type QuipAction =
  | QuipActionAdd
  | QuipActionDel
  | NoteActionAddFeel
  | NoteActionDelFeel;

export type DisplayMode = 'list' | 'grid';

export type SortMode = 'alpha' | 'time' | 'arranged';

export interface Diary {
  perms: Perm;
  view: DisplayMode;
  order: string[];
  sort: SortMode;
  saga: Saga | null;
}

export interface Shelf {
  [key: string]: Diary;
}

export interface Brief {
  last: number;
  count: number;
  'read-id': string | null;
}

export interface Briefs {
  [nest: Nest]: Brief;
}

export interface BriefUpdate {
  nest: Nest;
  brief: Brief;
}

export interface Create {
  han: Han;
  group: Flag;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface Perm {
  writers: string[];
  group: Flag;
}

export interface Said {
  nest: Nest;
  note: Note;
}

export interface Init {
  briefs: Briefs;
  shelf: Shelf;
}

export type Diff = CreateDiff | Command;

export type Action =
  | { join: Flag } // group flag
  | { leave: null }
  | { read: null }
  | { 'read-at': string }
  | { watch: null }
  | { unwatch: null }
  | Command;

export type ShelfAction =
  | { diary: { nest: Nest; action: Action } }
  | { create: Create };

export type Command =
  | { note: NoteAction }
  | DiffView
  | DiffAddWriters
  | DiffDelWriters
  | DiffArrangedNotes
  | DiffSort;

export type NoteResponse =
  | { set: Note | null }
  | { quip: { id: string; response: QuipResponse; meta: QuipMeta } }
  | { essay: NoteEssay }
  | { feels: Record<string, string> };

export type QuipResponse = { set: Quip } | { feels: Record<string, string> };

export type Response =
  | { notes: NoteMap }
  | {
      note: {
        id: string;
        'r-note': NoteResponse;
      };
    }
  | { order: string[] }
  | { view: DisplayMode }
  | { sort: SortMode }
  | { perm: Perm }
  | { create: Perm }
  | { join: string }
  | { leave: null }
  | { read: null }
  | { 'read-at': string }
  | { watch: null }
  | { unwatch: null };

export interface ShelfResponse {
  nest: Nest;
  response: Response;
}

export function isCite(s: Block): boolean {
  if ('cite' in s) {
    return true;
  }
  return false;
}

export function blockContentIsImage(content: Story) {
  return (
    content.length > 0 &&
    content.filter((c) => 'block' in c).length > 0 &&
    isImage((content.filter((c) => 'block' in c)[0] as VerseBlock).block)
  );
}

export function imageUrlFromContent(content: Story) {
  if (blockContentIsImage(content)) {
    return (
      (content.filter((c) => 'block' in c)[0] as VerseBlock).block as Image
    ).image.src;
  }
  return undefined;
}

export function inlineContentIsLink(content: Story) {
  return (
    content.length > 0 &&
    isLink((content.filter((c) => 'inline' in c)[0] as VerseInline).inline[0])
  );
}

export function linkUrlFromContent(content: Story) {
  if (inlineContentIsLink(content)) {
    return (
      (content.filter((c) => 'inline' in c)[0] as VerseInline).inline[0] as Link
    ).link.href;
  }
  return undefined;
}

export function chatStoryFromStory(story: Story): ChatStory {
  const newCon: ChatStory = {
    inline: [],
    block: [],
  };

  const inlines: Inline[] = story
    .filter((s) => 'inline' in s)
    .map((s) => (s as VerseInline).inline)
    .flat();
  const blocks: ChatBlock[] = story
    .filter((s) => 'block' in s)
    .map((s) => (s as VerseBlock).block as ChatBlock)
    .flat();

  newCon.inline = inlines;
  newCon.block = blocks;

  return newCon;
}

export function storyFromChatStory(chatStory: ChatStory): Story {
  const newStory: Story = [];

  const inlines: Inline[] = chatStory.inline;
  const blocks: Block[] = chatStory.block;

  newStory.push({ inline: inlines });

  blocks.forEach((b) => {
    newStory.push({ block: b });
  });

  return newStory;
}

export function getIdFromNoteAction(noteAction: NoteAction): string {
  if ('add' in noteAction) {
    return noteAction.add.sent.toString();
  }
  if ('edit' in noteAction) {
    return noteAction.edit.id;
  }
  if ('del' in noteAction) {
    return noteAction.del;
  }
  if ('add-feel' in noteAction) {
    return noteAction['add-feel'].id;
  }
  if ('del-feel' in noteAction) {
    return noteAction['del-feel'].id;
  }
  if ('quip' in noteAction) {
    return noteAction.quip.id;
  }
  return '';
}

export const emptyNote: Note = {
  seal: {
    id: '',
    feels: {},
    quips: null,
    meta: {
      quipCount: 0,
      lastQuippers: [],
      lastQuip: null,
    },
  },
  essay: {
    author: '',
    content: [],
    sent: 0,
    'han-data': { chat: null },
  },
};

export const emptyQuip: Quip = {
  cork: {
    id: '',
    feels: {},
  },
  memo: {
    author: '',
    content: [],
    sent: 0,
  },
};

export function constructStory(data: (Inline | Block)[]): Story {
  const isBlock = (c: Inline | Block) =>
    [
      'image',
      'chan',
      'desk',
      'bait',
      'group',
      'listing',
      'header',
      'rule',
      'code',
    ].some((k) => typeof c !== 'string' && k in c);
  const noteContent: Story = [];
  let index = 0;
  data.forEach((c, i) => {
    if (i < index) {
      return;
    }

    if (isBlock(c)) {
      noteContent.push({ block: c as Block });
      index += 1;
    } else {
      const inline = _.takeWhile(
        _.drop(data, index),
        (d) => !isBlock(d)
      ) as Inline[];
      noteContent.push({ inline });
      index += inline.length;
    }
  });

  return noteContent;
}

export function newQuipMap(
  entries?: [BigInteger, Quip][],
  reverse = false
): BTree<BigInteger, Quip> {
  return new BTree<BigInteger, Quip>(entries, (a, b) =>
    reverse ? b.compare(a) : a.compare(b)
  );
}

export function newNoteMap(entries?: NoteTuple[], reverse = false): NoteMap {
  return new BTree<BigInteger, Note | null>(entries, (a, b) =>
    reverse ? b.compare(a) : a.compare(b)
  );
}
