import { BigInteger } from 'big-integer';
import BTree from 'sorted-btree';
import {
  KindDataChat,
  PostEssay,
  PostSeal,
  PostSealInCache,
  Reply,
  ReplyCork,
  ReplyMeta,
} from './channel';
import { GroupMeta } from './groups';

export type Patda = string;
export type Ship = string;

export interface Writ {
  seal: WritSeal;
  essay: WritEssay;
}

export interface WritEssay extends PostEssay {
  'kind-data': KindDataChat;
}

export interface WritReplyCork extends ReplyCork {
  time: string;
}

export interface WritReply extends Reply {
  cork: WritReplyCork;
}

export interface WritReplyReferenceResponse {
  reply: {
    'id-post': string;
    reply: WritReply;
  };
}

export type WritReplyMap = BTree<BigInteger, WritReply>;

export interface WritSeal extends PostSeal {
  time: string;
}

interface WritDeltaAdd {
  add: {
    memo: Omit<PostEssay, 'kind-data'>;
    kind: null;
    time: string | null;
  };
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

interface ReplyDeltaAdd {
  add: {
    memo: Omit<PostEssay, 'kind-data'>;
    time: string | null;
  };
}

interface ReplyDeltaDel {
  del: null;
}

interface ReplyDeltaAddFeel {
  'add-feel': {
    ship: string;
    feel: string;
  };
}

interface ReplyDeltaDelFeel {
  'del-feel': string;
}

interface ReplyDelta {
  reply: {
    id: Patda;
    meta: ReplyMeta | null;
    delta:
      | ReplyDeltaAdd
      | ReplyDeltaDel
      | ReplyDeltaAddFeel
      | ReplyDeltaDelFeel;
  };
}

export type WritDelta =
  | WritDeltaAdd
  | WritDeltaDel
  | WritDeltaAddFeel
  | WritDeltaDelFeel
  | ReplyDelta;

export interface WritDiff {
  id: string;
  delta: WritDelta;
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

export type WritMap = BTree<BigInteger, Writ>;

export type WritTuple = [BigInteger, Writ];

export function newWritMap(entries?: WritTuple[], reverse = false): WritMap {
  return new BTree<BigInteger, Writ>(entries, (a, b) =>
    reverse ? b.compare(a) : a.compare(b)
  );
}

export interface Pact {
  writs: WritMap;
  index: {
    [id: string]: BigInteger;
  };
}

export interface Writs {
  [time: Patda]: Writ;
}

export interface DMBrief {
  last: number;
  count: number;
  'read-id': string | null;
}

export interface DMBriefs {
  [whom: DMWhom]: DMBrief;
}

export interface DMBriefUpdate {
  whom: DMWhom;
  brief: DMBrief;
}
/**
 * Either a `@p` or `@uv` rendered as string
 */
export type DMWhom = string;

export interface Pins {
  pins: DMWhom[];
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

export interface TalkInit {
  clubs: Clubs;
  dms: string[];
  briefs: DMBriefs;
  invited: string[];
  pins: string[];
}

export type ChatScanItem = { writ: Writ } | WritReplyReferenceResponse;

export type ChatScan = ChatScanItem[];

interface WritSealInCache extends PostSealInCache {
  time: number;
}

export interface WritInCache {
  seal: WritSealInCache;
  memo: WritEssay;
}
