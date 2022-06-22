import {
  Chat,
  ChatWhom,
  ChatMemo,
  Pact,
  ChatBriefs,
  ChatStory,
  Club,
  Hive,
} from '../../types/chat';
import { GroupMeta } from '../../types/groups';

export interface ChatState {
  set: (fn: (sta: ChatState) => void) => void;
  batchSet: (fn: (sta: ChatState) => void) => void;
  chats: {
    [flag: string]: Chat;
  };
  dms: {
    [ship: string]: Chat;
  };
  dmSubs: string[];
  dmArchive: string[];
  multiDms: {
    [id: string]: Club; // id is `@uw`
  };
  pinnedDms: string[];
  fetchDms: () => Promise<void>;
  pacts: {
    [whom: ChatWhom]: Pact;
  };
  pendingDms: string[];
  briefs: ChatBriefs;
  pinDm: (whom: string) => Promise<void>;
  unpinDm: (whom: string) => Promise<void>;
  markRead: (whom: string) => Promise<void>;
  start: () => Promise<void>;
  dmRsvp: (ship: string, ok: boolean) => Promise<void>;
  getDraft: (whom: string) => void;
  fetchOlder: (ship: string, count: string) => Promise<boolean>;
  draft: (whom: string, content: ChatStory) => Promise<void>;
  joinChat: (flag: string) => Promise<void>;
  archiveDm: (ship: string) => Promise<void>;
  unarchiveDm: (ship: string) => Promise<void>;
  sendMessage: (whom: string, memo: ChatMemo) => void;
  delMessage: (flag: string, time: string) => void;
  addSects: (flag: string, writers: string[]) => Promise<void>;
  create: (req: {
    group: string;
    name: string;
    title: string;
    description: string;
    readers: string[];
  }) => Promise<void>;
  initializeMultiDm: (id: string) => Promise<void>;
  createMultiDm: (
    hive: string[] // array of ships
  ) => Promise<void>;
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
  sendMultiDm: (
    id: string, // `@uw` - the club ID
    chatId: string, // a whom
    memo: Omit<ChatMemo, 'sent'>
  ) => Promise<void>;
  multiDmRsvp: (
    id: string, // `@uw` - the club ID
    ok: boolean // whether the invite was accepted/rejected
  ) => Promise<void>;
  initialize: (flag: string) => Promise<void>;
  initializeDm: (ship: string) => Promise<void>;
}

// hives and meta types
