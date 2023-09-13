import { BigIntOrderedMap } from '@urbit/api';
import { Inline, isLink, Link } from './content';
import { Flag } from './hark';
import { Saga } from './groups';
import { ChatBlock, ChatStory } from './chat';

export type Patda = string;
export type Ship = string;
export type Nest = string;

export interface NoteSeal {
  id: string;
  quips: QuipMap;
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

export type Block = Image | Cite | ListingBlock | Header | Rule | Code;

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

export type Note = null | {
  type: 'note';
  seal: NoteSeal;
  essay: NoteEssay;
};

export interface Outline extends NoteEssay {
  quipCount: number;
  quippers: Ship[];
}

export interface Outlines {
  [time: string]: Outline;
}

export type OutlineTuple = [string, Outline];

export type OutlinesMap = BigIntOrderedMap<Outline>;

export type NoteMap = BigIntOrderedMap<Note>;

export interface Quip {
  cork: QuipCork;
  memo: Memo;
}

export interface Memo {
  content: Story;
  author: Ship;
  sent: number;
}

export type QuipMap = BigIntOrderedMap<Quip>;

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
  outline: Outline;
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
  | { quip: { id: string; response: QuipResponse } }
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
  if ('chan' in s) {
    return true;
  }
  if ('group' in s) {
    return true;
  }

  if ('desk' in s) {
    return true;
  }

  if ('bait' in s) {
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
    .map((s) => (s as VerseBlock).block)
    .flat()
    .map((s) => {
      if (isCite(s)) {
        return { cite: s } as ChatBlock;
      }
      return s as ChatBlock;
    });

  newCon.inline = inlines;
  newCon.block = blocks;

  return newCon;
}

export function storyFromChatStory(chatStory: ChatStory): Story {
  const newStory: Story = [];

  const inlines: Inline[] = chatStory.inline;
  const blocks: Block[] = chatStory.block.map((b) => {
    if ('cite' in b) {
      return b.cite;
    }
    return b;
  });

  newStory.push({ inline: inlines });

  blocks.forEach((b) => {
    newStory.push({ block: b });
  });

  return newStory;
}
