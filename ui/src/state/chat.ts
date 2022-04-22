import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useCallback } from 'react';
import { SubscriptionInterface } from '@urbit/http-api';
import { ChatDiff, ChatMemo, ChatUpdate, ChatWrit } from '../types/chat';
import api from '../api';

setAutoFreeze(false);

interface ChatApi {
  newest: (flag: string, count: number) => Promise<Record<string, any>>;
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
  chats: {
    [flag: string]: BigIntOrderedMap<ChatWrit>;
  };
  sendMessage: (flag: string, memo: ChatMemo) => void;
  initialize: (flag: string) => Promise<void>;
}

export const useChatState = create<ChatState>((set, get) => ({
  set: (fn) => {
    set(produce(get(), fn));
  },
  chats: {
    '~zod/test': new BigIntOrderedMap<ChatWrit>(),
  },
  sendMessage: (flag, memo) => {
    chatApi.sendMessage(flag, memo);
  },
  initialize: async (flag: string) => {
    const chat = await chatApi.newest(flag, 100);
    get().set((draft) => {
      draft.chats[flag] = new BigIntOrderedMap();
      chat.forEach((writ: ChatWrit) => {
        const tim = bigInt(udToDec(writ.seal.time));
        draft.chats[flag] = draft.chats[flag].set(tim, writ);
      });
    });

    chatApi.subscribe(flag, {
      event: (data: unknown) => {
        const update = data as ChatUpdate;
        get().set((draft) => {
          if ('add' in update.diff) {
            const time = bigInt(udToDec(update.time));
            const seal = { time: update.time, feels: {} };
            const writ = { seal, memo: update.diff.add };
            draft.chats[flag] = draft.chats[flag].set(time, writ);
          } else if ('del' in update.diff) {
            const time = bigInt(udToDec(update.diff.del));
            draft.chats[flag] = draft.chats[flag].delete(time);
          } else if ('add-feel' in update.diff) {
            const diff = update.diff['add-feel'];
            const time = bigInt(udToDec(diff.time));
            const writ = draft.chats[flag].get(time);
            writ.seal.feels[diff.ship] = diff.feel;
            draft.chats[flag] = draft.chats[flag].set(time, writ);
          }
        });
      },
    });
  },
}));

export function useMessagesForChat(flag: string) {
  return useChatState(useCallback((s) => s.chats[flag], [flag]));
}
