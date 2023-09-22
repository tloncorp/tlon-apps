import { Note, NoteEssay } from '@/types/channel';
import {
  DMWhom,
  Pact,
  DMBriefs,
  Club,
  Hive,
  Clubs,
  TalkInit,
} from '@/types/dms';
import { BaseState } from '@/state/base';
import { GroupMeta } from '@/types/groups';
import { WindowSet } from '@/logic/windows';

export interface TrackedMessage {
  id: string;
  status: 'pending' | 'sent' | 'delivered';
}

export interface ChatState {
  batchSet: (fn: (sta: BasedChatState) => void) => void;
  multiDms: Clubs;
  dms: string[];
  trackedMessages: TrackedMessage[];
  pins: DMWhom[];
  pacts: {
    [whom: DMWhom]: Pact;
  };
  writWindows: {
    [whom: DMWhom]: WindowSet;
  };
  loadedRefs: {
    [path: string]: Note;
  };
  loadedGraphRefs: {
    [path: string]: Note | 'loading' | 'error';
  };
  pendingDms: string[];
  fetchDms: () => Promise<void>;
  fetchMultiDm: (id: string, force?: boolean) => Promise<Club>;
  fetchMultiDms: () => Promise<void>;
  togglePin: (whom: string, pin: boolean) => Promise<void>;
  fetchPins: () => Promise<void>;
  markDmRead: (whom: string) => Promise<void>;
  start: (init: TalkInit) => Promise<void>;
  dmRsvp: (ship: string, ok: boolean) => Promise<void>;
  fetchMessages: (
    ship: string,
    count: string,
    dir: 'newer' | 'older',
    time?: string
  ) => Promise<boolean>;
  fetchMessagesAround: (
    ship: string,
    count: string,
    time: string
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
