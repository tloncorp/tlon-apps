import { udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import _ from 'lodash';
import BTree from 'sorted-btree';

import {
  KindDataChat,
  PostEssay,
  PostSeal,
  PostSealDataResponse,
  Reply,
  ReplyMeta,
  ReplySeal,
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

export interface WritReplySeal extends ReplySeal {
  time: string;
}

export interface WritReply extends Reply {
  seal: WritReplySeal;
}

export type WritMemo = Omit<PostEssay, 'kind-data'>;

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

export interface WritDeltaAdd {
  add: {
    memo: WritMemo;
    kind: null;
    time: string | null;
  };
}

interface WritDeltaDel {
  del: null;
}

interface WritDeltaAddReact {
  'add-react': {
    react: string;
    ship: string;
  };
}

interface WritDeltaDelReact {
  'del-react': string;
}

export interface ReplyDeltaAdd {
  add: {
    memo: WritMemo;
    time: string | null;
  };
}

export interface ReplyDeltaDel {
  del: null;
}

export interface ReplyDeltaAddReact {
  'add-react': {
    ship: string;
    react: string;
  };
}

export interface ReplyDeltaDelReact {
  'del-react': string;
}

export interface ReplyDelta {
  reply: {
    id: Patda;
    meta: ReplyMeta | null;
    delta:
      | ReplyDeltaAdd
      | ReplyDeltaDel
      | ReplyDeltaAddReact
      | ReplyDeltaDelReact;
  };
}

export type WritDelta =
  | WritDeltaAdd
  | WritDeltaDel
  | WritDeltaAddReact
  | WritDeltaDelReact
  | ReplyDelta;

export interface WritDiff {
  id: string;
  delta: WritDelta;
}

export interface WritResponseAdd {
  add: {
    memo: WritMemo;
    time: string;
  };
}

export type WritResponseDelta =
  | WritResponseAdd
  | WritDeltaDel
  | WritDeltaAddReact
  | WritDeltaDelReact
  | ReplyDelta;

export interface WritResponse {
  whom: string;
  id: string;
  response: WritResponseDelta;
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

export interface BlockedByUpdate {
  'blocked-by': string;
}

export interface UnblockedByUpdate {
  'unblocked-by': string;
}

export type ChatUIEvent = BlockedByUpdate | UnblockedByUpdate | ToggleMessage;

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

export function newWritTupleArray(
  data:
    | {
        pages: PagedWrits[];
      }
    | undefined
): WritTuple[] {
  if (data === undefined || data.pages.length === 0) {
    return [];
  }

  return _.uniqBy(
    data?.pages
      ?.map((page) => {
        const writPages = Object.entries(page.writs).map(
          ([k, v]) => [bigInt(udToDec(k)), v] as WritTuple
        );
        return writPages;
      })
      .flat() || [],
    ([k]) => k.toString()
  ).sort(([a], [b]) => a.compare(b));
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

export interface PagedWrits {
  writs: Writs;
  newer: string | null;
  older: string | null;
  total: number;
}

export type WritPageMap = BTree<BigInteger, Writ | null>;

export interface PagedWritsMap extends Omit<PagedWrits, 'writs'> {
  writs: WritPageMap;
}

export interface DmUnreadMessageKey {
  id: string;
  time: string;
}

export interface DMUnreadPoint extends DmUnreadMessageKey {
  count: number;
}

export interface DMUnreadThread extends DMUnreadPoint {
  'parent-time': string;
}

export interface DMUnread {
  recency: number;
  count: number;
  unread: DMUnreadPoint | null;
  threads: Record<string, DMUnreadThread>;
}

export interface DMUnreads {
  [whom: DMWhom]: DMUnread;
}

export interface DMUnreadUpdate {
  whom: DMWhom;
  unread: DMUnread;
}

/**
 * Either a `@p` or `@uv` rendered as string
 */
export type DMWhom = string;

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

export interface DMInit {
  clubs: Clubs;
  dms: string[];
  invited: string[];
  ['hidden-messages']: string[];
  blocked: string[];
  ['blocked-by']: string[];
}

export interface DMInit2 {
  clubs: Clubs;
  dms: string[];
  invited: string[];
  'hidden-messages': HiddenMessages;
  blocked: BlockedShips;
  'blocked-by': BlockedByShips;
}

export type ChatScanItem = { writ: Writ } | WritReplyReferenceResponse;

export type ChatScan = ChatScanItem[];

export type ChatScam = { last: string | null; scan: ChatScan };

interface WritSealInCache extends PostSealDataResponse {
  time: number;
}

export interface WritInCache {
  seal: WritSealInCache;
  memo: WritEssay;
}

export type BlockedShips = string[];

export type BlockedByShips = string[];

export type ToggleMessage = { hide: string } | { show: string };

export type HiddenMessages = string[];

export type ChatHead = {
  recency: number;
  whom: string;
  latest: Writ;
};

export type ChatHeadsResponse = ChatHead[];
