import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import api from '../api';
import { ChatUpdate, ChatWrit, ChatWrits, Patda } from '../types/chat';
import { BigIntOrderedMap, daToDate, udToDec, unixToDa } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useCallback } from 'react';
import {
  SubscriptionInterface,
  SubscriptionRequestInterface,
} from '@urbit/http-api';
import { chatWrits } from '../fixtures/chat';

setAutoFreeze(false);
const IS_MOCK = import.meta.env.MODE === 'mock';
console.log('IS_MOCK', IS_MOCK);

interface ChatApi {
  newest: (flag: string, count: number) => Promise<ChatWrit[]>;
  subscribe: (flag: string, opts: SubscriptionInterface) => Promise<number>;
}

const chatApi: ChatApi = IS_MOCK
  ? {
      subscribe: (flag, opts) => Promise.resolve(1),
      newest: (flag, count) => Promise.resolve(chatWrits),
    }
  : {
      subscribe: (flag, opts) =>
        api.subscribe({ app: 'chat', path: `/chat/${flag}/ui`, ...opts }),
      newest: (flag, count) => {
        return api.scry<ChatWrit[]>({
          app: 'chat',
          path: `/chat/${flag}/writs/newest/${count}`,
        });
      },
    };

interface ChatState {
  set: (fn: (sta: ChatState) => void) => void;
  chats: {
    [flag: string]: BigIntOrderedMap<ChatWrit>;
  };
  sendMessage: () => void;
  initialize: (flag: string) => Promise<void>;
}

export const useChatState = create<ChatState>((set, get) => ({
  set: (fn: any) => {
    set(produce(get(), fn));
  },
  chats: {
    '~zod/test': new BigIntOrderedMap<ChatWrit>(),
  },
  sendMessage: () => {},
  initialize: async (flag: string) => {
    const chat = await chatApi.newest(flag, 100);
    get().set((draft) => {
      chat.forEach((writ) => {
        const tim = bigInt(udToDec(writ.seal.time));
        draft.chats[flag] = draft.chats[flag].set(tim, writ);
      });
    });

    chatApi.subscribe(flag, {
      event: (data: any) => {
        const update = data as ChatUpdate;
        console.log('subscription', update);
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
            let writ = draft.chats[flag].get(time);
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
