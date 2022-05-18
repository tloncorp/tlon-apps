import { BigIntOrderedMap } from '@urbit/api';
import {
  Chat,
  ChatWrit,
  ChatWhom,
  ChatMemo,
  Pact,
  ChatBriefs,
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
  pacts: {
    [whom: ChatWhom]: Pact;
  };
  briefs: ChatBriefs;
  markRead: (whom: string) => Promise<void>;
  start: () => Promise<void>;
  draft: (whom: string, content: ChatMemo['content']) => Promise<void>;
  joinChat: (flag: string) => Promise<void>;
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
