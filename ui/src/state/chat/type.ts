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
  drafts: {
    [whom: string]: ChatStory;
  };
  dmSubs: string[];
  dmArchive: string[];
  multiDms: {
    [id: string]: Club; // id is `@uw`
  };
  multiDmSubs: string[];
  pinnedDms: string[];
  fetchDms: () => Promise<void>;
  fetchMultiDm: (id: string, force?: boolean) => Promise<Club>;
  pacts: {
    [whom: ChatWhom]: Pact;
  };
  pendingDms: string[];
  briefs: ChatBriefs;
  toggleDmPin: (whom: string, pin: boolean) => Promise<void>;
  toggleMultiDmPin: (whom: string, pin: boolean) => Promise<void>;
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
  addSects: (flag: string, writers: string[]) => Promise<void>;
  create: (req: {
    group: string;
    name: string;
    title: string;
    description: string;
    readers: string[];
  }) => Promise<void>;
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
}
