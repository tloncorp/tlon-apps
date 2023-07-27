import { BigInteger } from 'big-integer';
import BTree from 'sorted-btree';
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
import { GroupMeta, Saga } from './groups';

export type Patda = string;
export type Ship = string;

export interface ChanCite {
  chan: {
    nest: string;
    where: string;
  };
}

export interface GroupCite {
  group: string;
}

export interface BaitCite {
  bait: {
    group: string;
    graph: string;
    where: string;
  };
}

export interface DeskCite {
  desk: {
    flag: string;
    where: string;
  };
}

export type Cite = ChanCite | GroupCite | DeskCite | BaitCite;

export type ChatBlock = ChatImage | { cite: Cite };

export interface ChatImage {
  image: {
    src: string;
    height: number;
    width: number;
    alt: string;
  };
}

export type ChatInline =
  | string
  | Bold
  | Italics
  | Strikethrough
  | Ship
  | Break
  | BlockReference
  | InlineCode
  | BlockCode
  | Blockquote
  | Tag
  | Link;

export function isChatImage(item: unknown): item is ChatImage {
  return typeof item === 'object' && item !== null && 'image' in item;
}

export interface ChatStory {
  block: ChatBlock[];
  inline: Inline[];
}

export interface ChatSeal {
  id: string;
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

export interface ChatNotice {
  pfix: string;
  sfix: string;
}

export type ChatMessage = { story: ChatStory } | { notice: ChatNotice };

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

export interface ChatWrits {
  [time: string]: ChatWrit;
}

interface WritDeltaAdd {
  add: ChatMemo;
}

interface WritDeltaDel {
  del: null;
}

interface WritDeltaAddFeel {
  'add-feel': {
    feel: string;
    ship: string;
  };
}

interface WritDeltaDelFeel {
  'del-feel': string;
}

interface ChatDiffAddSects {
  'add-sects': string[];
}

interface ChatDiffDelSects {
  'del-sects': string[];
}

export type WritDelta =
  | WritDeltaAdd
  | WritDeltaDel
  | WritDeltaAddFeel
  | WritDeltaDelFeel;

export interface WritDiff {
  id: string;
  delta: WritDelta;
}

export interface ChatDiffCreate {
  create: Chat;
}

export type ChatDiff =
  | { writs: WritDiff }
  | ChatDiffCreate
  | ChatDiffAddSects
  | ChatDiffDelSects;

export interface ChatUpdate {
  time: Patda;
  diff: ChatDiff;
}

export interface ChatAction {
  flag: string;
  update: ChatUpdate;
}

export interface Chat {
  perms: ChatPerm;
  saga: Saga | null;
}

export interface Chats {
  [key: string]: Chat;
}

/**
 * A Club is the backend terminology for Multi DMs
 */
export interface Club {
  hive: string[];
  team: string[];
  meta: GroupMeta;
}

export interface Clubs {
  [id: string]: Club; // id is `@uv`
}

export interface DmAction {
  ship: string;
  diff: WritDiff;
}

export interface DmRsvp {
  ship: string;
  ok: boolean;
}

export function newWritMap(
  entries?: [BigInteger, ChatWrit][],
  reverse = false
): BTree<BigInteger, ChatWrit> {
  return new BTree<BigInteger, ChatWrit>(entries, (a, b) =>
    reverse ? b.compare(a) : a.compare(b)
  );
}

export interface Pact {
  writs: BTree<BigInteger, ChatWrit>;
  index: {
    [id: string]: BigInteger;
  };
}

export interface ChatDraft {
  whom: string;
  story: ChatStory;
}

export interface ChatBrief {
  last: number;
  count: number;
  'read-id': string | null;
}

export interface ChatBriefs {
  [whom: ChatWhom]: ChatBrief;
}

export interface ChatBriefUpdate {
  whom: ChatWhom;
  brief: ChatBrief;
}
/**
 * Either a `@p` or a `$flag` rendered as string
 */
export type ChatWhom = string;

export interface Pins {
  pins: ChatWhom[];
}

// Clubs, AKA MultiDMs

export interface ClubCreate {
  id: string;
  hive: Ship[];
}

export interface ClubInvite extends Club {
  id: string;
}

export interface Hive {
  by: string;
  for: string;
  add: boolean;
}

interface ClubDeltaInit {
  init: {
    team: string[];
    hive: string[];
    meta: GroupMeta;
  };
}

interface ClubDeltaEditMetadata {
  meta: GroupMeta;
}

interface ClubDeltaAddHive {
  hive: Hive & { add: true };
}

interface ClubDeltaRemoveHive {
  hive: Hive & { add: false };
}

interface ClubDeltaRsvp {
  team: {
    ship: Ship;
    ok: boolean;
  };
}

interface ClubDeltaWrit {
  writ: WritDiff;
}

export type ClubDelta =
  | ClubDeltaInit
  | ClubDeltaEditMetadata
  | ClubDeltaAddHive
  | ClubDeltaRemoveHive
  | ClubDeltaRsvp
  | ClubDeltaWrit;

export type ClubDiff = {
  uid: string;
  delta: ClubDelta;
};

export interface ClubAction {
  id: string;
  diff: ClubDiff;
}

export interface ChatCreate {
  group: string;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface ChatPerm {
  writers: string[];
  readers: string[];
  group: string;
}

export interface ChatJoin {
  group: string;
  chan: string;
}

export interface ChatInit {
  briefs: ChatBriefs;
  chats: Chats;
  pins: string[];
}

export interface TalkChatInit extends ChatInit {
  clubs: Clubs;
  dms: string[];
  invited: string[];
  pins: string[];
}

export interface ChatScanItem {
  time: string;
  writ: ChatWrit;
}

export type ChatScan = ChatScanItem[];
