import {
  Chat,
  ChatWhom,
  ChatMemo,
  Pact,
  ChatBriefs,
  ChatStory,
  ChatMessage,
} from '../../types/chat';

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
  createMultiDm: (
    hive: string[] // array of ships
  ) => Promise<void>;
  editMultiDm: (
    id: string, // `@uw`
    meta: {
      title: string;
      description: string;
      image: string;
    },
    echo: number
  ) => Promise<void>;
  inviteToMultiDm: (
    id: string, // `@uw`
    by: string, // the sending ship
    target: string, // the invited ship, labeled as `for` in the poke,
    echo: number // initially 0, increments as gossip happens
  ) => Promise<void>;
  removeFromMultiDm: (
    id: string, // `@uw`
    by: string, // the sending ship
    target: string, // the removed ship, labeled as `for` in the poke,
    echo: number // initially 0, increments as gossip happens
  ) => Promise<void>;
  sendMultiDm: (
    id: string, // `@uw` - the club ID
    chatId: string, // a whom
    author: string, // the sending ship
    replying: string | null, // the removed ship, labeled as `for` in the poke,
    content: ChatMessage,
    echo: number // initially 0, increments as gossip happens
  ) => Promise<void>;
  initialize: (flag: string) => Promise<void>;
  initializeDm: (ship: string) => Promise<void>;
}
