import {
  Chat,
  ChatWhom,
  ChatMemo,
  Pact,
  ChatBriefs,
  ChatStory,
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
  drafts: {
    [whom: string]: ChatStory;
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
  draft: (whom: string, story: ChatStory) => Promise<void>;
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
  initialize: (flag: string) => Promise<void>;
  initializeDm: (ship: string) => Promise<void>;
}
