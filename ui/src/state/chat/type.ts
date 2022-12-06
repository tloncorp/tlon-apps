import bigInt from 'big-integer';
import {
  Chat,
  ChatWhom,
  ChatMemo,
  Pact,
  ChatBriefs,
  ChatStory,
  Club,
  Hive,
  ChatCreate,
  ChatWrit,
} from '../../types/chat';
import { BaseState } from '../base';
import { GroupMeta } from '../../types/groups';

export interface ChatState {
  set: (fn: (sta: BasedChatState) => void) => void;
  batchSet: (fn: (sta: BasedChatState) => void) => void;
  chats: {
    [flag: string]: Chat;
  };
  dms: {
    [ship: string]: Chat;
  };
  multiDms: {
    [id: string]: Club; // id is `@uw`
  };
  drafts: {
    [whom: string]: ChatStory;
  };
  pendingImports: Record<string, boolean>;
  chatSubs: string[];
  dmSubs: string[];
  sentMessages: string[];
  postedMessages: string[];
  multiDmSubs: string[];
  pins: ChatWhom[];
  dmArchive: string[];
  fetchDms: () => Promise<void>;
  fetchMultiDm: (id: string, force?: boolean) => Promise<Club>;
  pacts: {
    [whom: ChatWhom]: Pact;
  };
  loadedWrits: {
    [whom: ChatWhom]: {
      oldest: bigInt.BigInteger;
      newest: bigInt.BigInteger;
    };
  };
  loadedRefs: {
    [path: string]: ChatWrit;
  };
  loadedGraphRefs: {
    [path: string]: ChatWrit | 'loading' | 'error';
  };
  pendingDms: string[];
  briefs: ChatBriefs;
  togglePin: (whom: string, pin: boolean) => Promise<void>;
  fetchPins: () => Promise<void>;
  markRead: (whom: string) => Promise<void>;
  start: () => Promise<void>;
  dmRsvp: (ship: string, ok: boolean) => Promise<void>;
  getDraft: (whom: string) => void;
  fetchNewer: (ship: string, count: string) => Promise<boolean>;
  fetchOlder: (ship: string, count: string) => Promise<boolean>;
  draft: (whom: string, story: ChatStory) => Promise<void>;
  joinChat: (flag: string) => Promise<void>;
  leaveChat: (flag: string) => Promise<void>;
  archiveDm: (ship: string) => Promise<void>;
  unarchiveDm: (ship: string) => Promise<void>;
  sendMessage: (whom: string, memo: ChatMemo) => void;
  delMessage: (flag: string, time: string) => void;
  addFeel: (whom: string, id: string, feel: string) => Promise<void>;
  delFeel: (whom: string, id: string) => Promise<void>;
  addSects: (flag: string, writers: string[]) => Promise<void>;
  delSects: (flag: string, writers: string[]) => Promise<void>;
  create: (req: ChatCreate) => Promise<void>;
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
