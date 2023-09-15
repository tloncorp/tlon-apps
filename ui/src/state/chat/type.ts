import bigInt, { BigInteger } from 'big-integer';
import {
  ChatWhom,
  Pact,
  ChatBriefs,
  ChatStory,
  Club,
  Hive,
  Clubs,
  ChatInit,
  TalkChatInit,
} from '../../types/chat';
import { BaseState } from '../base';
import { GroupMeta } from '../../types/groups';
import { Note, NoteEssay } from '@/types/channel';

export interface WritWindow {
  oldest: bigInt.BigInteger;
  newest: bigInt.BigInteger;
  loadedOldest: boolean;
  loadedNewest: boolean;
  latest?: boolean;
}

export interface WritWindows {
  latest?: WritWindow;
  windows: WritWindow[];
}

export interface ChatState {
  // set: (fn: (sta: BasedChatState) => void) => void;
  batchSet: (fn: (sta: BasedChatState) => void) => void;
  multiDms: Clubs;
  dms: string[];
  drafts: {
    [whom: string]: ChatStory;
  };
  sentMessages: string[];
  postedMessages: string[];
  pins: ChatWhom[];
  dmArchive: string[];
  fetchDms: () => Promise<void>;
  fetchMultiDm: (id: string, force?: boolean) => Promise<Club>;
  fetchMultiDms: () => Promise<void>;
  pacts: {
    [whom: ChatWhom]: Pact;
  };
  writWindows: {
    [whom: ChatWhom]: WritWindows;
  };
  loadedRefs: {
    [path: string]: Note;
  };
  loadedGraphRefs: {
    [path: string]: Note | 'loading' | 'error';
  };
  pendingDms: string[];
  dmBriefs: ChatBriefs;
  getTime: (whom: string, id: string) => bigInt.BigInteger;
  togglePin: (whom: string, pin: boolean) => Promise<void>;
  fetchPins: () => Promise<void>;
  markDmRead: (whom: string) => Promise<void>;
  start: (init: ChatInit) => Promise<void>;
  startTalk: (init: TalkChatInit, startBase?: boolean) => Promise<void>;
  dmRsvp: (ship: string, ok: boolean) => Promise<void>;
  fetchMessages: (
    ship: string,
    count: string,
    dir: 'newer' | 'older',
    time?: BigInteger
  ) => Promise<boolean>;
  fetchMessagesAround: (
    ship: string,
    count: string,
    time: BigInteger
  ) => Promise<void>;
  archiveDm: (ship: string) => Promise<void>;
  unarchiveDm: (ship: string) => Promise<void>;
  sendMessage: (whom: string, essay: NoteEssay) => void;
  delDm: (flag: string, time: string) => void;
  addFeelToDm: (whom: string, id: string, feel: string) => Promise<void>;
  delFeelToDm: (whom: string, id: string) => Promise<void>;
  createMultiDm: (
    id: string,
    hive: string[] // array of ships
  ) => Promise<void>; // returns the newly created club ID
  editMultiDm: (
    id: string, // `@uw`
    meta: GroupMeta
  ) => Promise<void>;
  inviteToMultiDm: (
    id: string, // `@uw`
    hive: Omit<Hive, 'add'> // by is the sending ship, for is the invited ship
  ) => Promise<void>;
  removeFromMultiDm: (
    id: string, // `@uw`
    hive: Omit<Hive, 'add'> // by is the removing ship, for is the removed ship
  ) => Promise<void>;
  multiDmRsvp: (
    id: string, // `@uw` - the club ID
    ok: boolean // whether the invite was accepted/rejected
  ) => Promise<void>;
  initialize: (flag: string) => Promise<void>;
  initializeDm: (ship: string) => Promise<void>;
  initializeMultiDm: (id: string) => Promise<void>; // id is `@uw`, the Club ID
  [key: string]: unknown;
}

export type BasedChatState = ChatState & BaseState<ChatState>;
