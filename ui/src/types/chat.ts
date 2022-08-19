import { BigIntOrderedMap } from '@urbit/api';
import { BigInteger } from 'big-integer';
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
import { GroupMeta } from './groups';

export type Patda = string;
export type Ship = string;

export type ChatBlock = ChatImage;

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
    time: string;
    feel: string;
    ship: string;
  };
}

interface ChatDiffAddSects {
  'add-sects': string[];
}

interface ChatDiffDelSects {
  'del-sects': string[];
}

export type WritDelta = WritDeltaAdd | WritDeltaDel | WritDeltaAddFeel;

export interface WritDiff {
  id: string;
  delta: WritDelta;
}

export type ChatDiff =
  | { writs: WritDiff }
  | ChatDiffAddSects
  | ChatDiffDelSects;

export interface ChatUpdate {
  time: Patda;
  diff: WritDelta;
}

export interface Chat {
  perms: ChatPerm;
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

export interface DmAction {
  ship: string;
  diff: WritDiff;
}

export interface DmRsvp {
  ship: string;
  ok: boolean;
}

export interface Pact {
  writs: BigIntOrderedMap<ChatWrit>;
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

interface ClubDeltaSend {
  writ: {
    id: string; // note this is the Chat ID, *not* the Club ID
    delta: {
      add: ChatMemo;
    };
  };
}

export type ClubDelta =
  | ClubDeltaEditMetadata
  | ClubDeltaAddHive
  | ClubDeltaRemoveHive
  | ClubDeltaRsvp
  | ClubDeltaSend;

export type ClubDiff = {
  echo: number;
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
}
