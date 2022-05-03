import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useCallback, useMemo } from 'react';
import { SubscriptionInterface } from '@urbit/http-api';
import {
  Chat,
  ChatDiff,
  ChatMemo,
  ChatPerm,
  ChatUpdate,
  ChatWrit,
} from '../types/chat';
import api from '../api';

setAutoFreeze(false);

interface ChatApi {
  newest: (flag: string, count: number) => Promise<ChatWrit[]>;
  subscribe: (flag: string, opts: SubscriptionInterface) => Promise<number>;
  sendMessage: (flag: string, memo: ChatMemo) => Promise<number>;
}

function chatAction(flag: string, diff: ChatDiff) {
  return {
    app: 'chat',
    mark: 'chat-action',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

const chatApi: ChatApi = {
  subscribe: (flag, opts) =>
    api.subscribe({ app: 'chat', path: `/chat/${flag}/ui`, ...opts }),
  newest: (flag, count) =>
    api.scry({
      app: 'chat',
      path: `/chat/${flag}/writs/newest/${count}`,
    }),
  sendMessage: (flag, memo) => api.poke(chatAction(flag, { add: memo })),
};

interface ChatState {
  set: (fn: (sta: ChatState) => void) => void;
  batchSet: (fn: (sta: ChatState) => void) => void;
  chats: {
    [flag: string]: Chat;
  };
  flags: string[];
  fetchFlags: () => Promise<void>;
  joinChat: (flag: string) => Promise<void>;
  sendMessage: (flag: string, memo: ChatMemo) => void;
  addSects: (flag: string, writers: string[]) => Promise<void>;
  create: (req: {
    group: string;
    name: string;
    title: string;
    description: string;
    readers: string[];
  }) => Promise<void>;
  initialize: (flag: string) => Promise<void>;
}

export const useChatState = create<ChatState>((set, get) => ({
  set: (fn) => {
    set(produce(get(), fn));
  },
  batchSet: (fn) => {
    batchUpdates(() => {
      get().set(fn);
    });
  },
  flags: [] as string[],
  fetchFlags: async () => {
    const flags = await api.scry<string[]>({
      app: 'chat',
      path: '/chat',
    });
    get().batchSet((draft) => {
      draft.flags = flags;
    });
  },
  chats: {},
  joinChat: async (flag) => {
    await api.poke({
      app: 'chat',
      mark: 'flag',
      json: flag,
    });
    await get().fetchFlags();
  },
  sendMessage: (flag, memo) => {
    chatApi.sendMessage(flag, memo);
  },
  create: async (req) => {
    await api.poke({
      app: 'chat',
      mark: 'chat-create',
      json: req,
    });
  },
  addSects: async (flag, sects) => {
    await api.poke(chatAction(flag, { 'add-sects': sects }));
  },
  initialize: async (flag: string) => {
    const perms = await api.scry<ChatPerm>({
      app: 'chat',
      path: `/chat/${flag}/perm`,
    });
    const writs = await chatApi.newest(flag, 100);
    get().batchSet((draft) => {
      const chat = { writs: new BigIntOrderedMap<ChatWrit>(), perms };
      draft.chats[flag] = chat;
      writs.forEach((writ) => {
        const tim = bigInt(udToDec(writ.seal.time));
        draft.chats[flag].writs = draft.chats[flag].writs.set(tim, writ);
      });
    });

    chatApi.subscribe(flag, {
      event: (data: unknown) => {
        const update = data as ChatUpdate;
        get().batchSet((draft) => {
          if ('add' in update.diff) {
            const time = bigInt(udToDec(update.time));
            const seal = { time: update.time, feels: {} };
            const writ = { seal, memo: update.diff.add };
            draft.chats[flag].writs = draft.chats[flag].writs.set(time, writ);
          } else if ('del' in update.diff) {
            const time = bigInt(udToDec(update.diff.del));
            draft.chats[flag].writs = draft.chats[flag].writs.delete(time);
          } else if ('add-feel' in update.diff) {
            const diff = update.diff['add-feel'];
            const time = bigInt(udToDec(diff.time));
            const writ = draft.chats[flag].writs.get(time);
            writ.seal.feels[diff.ship] = diff.feel;
            draft.chats[flag].writs = draft.chats[flag].writs.set(time, writ);
          } else if ('add-sects' in update.diff) {
            const diff = update.diff['add-sects'];
            const chat = draft.chats[flag];
            chat.perms.writers = [...chat.perms.writers, ...diff];
          }
        });
      },
    });
  },
}));

export function useMessagesForChat(flag: string) {
  const def = useMemo(() => new BigIntOrderedMap<ChatWrit>(), []);
  return useChatState(
    useCallback((s) => s.chats[flag]?.writs || def, [flag, def])
  );
}

const defaultPerms = {
  writers: [],
};

export function useChatPerms(flag: string) {
  return useChatState(
    useCallback((s) => s.chats[flag]?.perms || defaultPerms, [flag])
  );
}

export function useChatIsJoined(flag: string) {
  return useChatState(useCallback((s) => s.flags.includes(flag), [flag]));
}
