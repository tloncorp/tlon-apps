import { BigInteger } from 'big-integer';
import BTree from 'sorted-btree';
import {
  HanChat,
  NoteEssay,
  NoteSeal,
  NoteSealInCache,
  Quip,
  QuipCork,
  QuipMeta,
} from './channel';
import { GroupMeta } from './groups';

export type Patda = string;
export type Ship = string;

export interface Writ {
  seal: WritSeal;
  essay: WritEssay;
}

export interface WritEssay extends NoteEssay {
  'han-data': HanChat;
}

export interface WritQuipCork extends QuipCork {
  time: string;
}

export interface WritQuip extends Quip {
  cork: WritQuipCork;
}

export interface WritQuipReferenceResponse {
  quip: {
    'id-note': string;
    quip: WritQuip;
  };
}

export type WritQuipMap = BTree<BigInteger, WritQuip>;

export interface WritSeal extends NoteSeal {
  time: string;
}

interface WritDeltaAdd {
  add: {
    memo: Omit<NoteEssay, 'han-data'>;
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

interface QuipDeltaAdd {
  add: {
    memo: Omit<NoteEssay, 'han-data'>;
    time: string | null;
  };
}

interface QuipDeltaDel {
  del: null;
}

interface QuipDeltaAddFeel {
  'add-feel': {
    ship: string;
    feel: string;
  };
}

interface QuipDeltaDelFeel {
  'del-feel': string;
}

interface QuipDelta {
  quip: {
    id: Patda;
    meta: QuipMeta | null;
    delta: QuipDeltaAdd | QuipDeltaDel | QuipDeltaAddFeel | QuipDeltaDelFeel;
  };
}

export type WritDelta =
  | WritDeltaAdd
  | WritDeltaDel
  | WritDeltaAddFeel
  | WritDeltaDelFeel
  | QuipDelta;

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

export type ChatScanItem = { writ: Writ } | WritQuipReferenceResponse;

export type ChatScan = ChatScanItem[];

interface WritSealInCache extends NoteSealInCache {
  time: number;
}

export interface WritInCache {
  seal: WritSealInCache;
  memo: WritEssay;
}
