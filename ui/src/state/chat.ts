import create from "zustand";
import produce, { setAutoFreeze } from "immer";
import api from "../api";
import { ChatUpdate, ChatWrit, ChatWrits, Patda } from "../types/chat";
import { BigIntOrderedMap, daToDate, udToDec, unixToDa } from "@urbit/api";
import bigInt, { BigInteger } from "big-integer";
import { useCallback } from "react";

setAutoFreeze(false);
window.api = api;

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
    "~zod/test": new BigIntOrderedMap<ChatWrit>(),
  },
  sendMessage: () => {},
  initialize: async (flag: string) => {
    const chat = await api.scry<ChatWrits>({
      app: "chat",
      path: `/chat/${flag}/fleet/newest/100`,
    });
    get().set((draft) => {
      chat.forEach(({ time, writ }) => {
        const tim = bigInt(udToDec(time));
        draft.chats[flag] = draft.chats[flag].set(tim, writ);
      });
    });

    api.subscribe({
      app: "chat",
      path: "/chat/~zod/test/ui",
      event: (data: any) => {
        const update = data as ChatUpdate;
        console.log('subscription', update);
        get().set((draft) => {
          if ("add" in update.diff) {
            const time = bigInt(udToDec(update.time));
            const seal = { time: update.time, feels: {} };
            const writ = { seal, memo: update.diff.add };
            draft.chats["~zod/test"] = draft.chats["~zod/test"].set(time, writ);
          } else if ("del" in update.diff) {
            const time = bigInt(udToDec(update.diff.del));
            draft.chats["~zod/test"] = draft.chats["~zod/test"].delete(time);
          } else if ("add-feel" in update.diff) {
            const diff = update.diff['add-feel'];
            const time = bigInt(udToDec(diff.time));
            let writ = draft.chats["~zod/test"].get(time);
            writ.seal.feels[diff.ship] = diff.feel;
            draft.chats["~zod/test"] = draft.chats["~zod/test"].set(time, writ);
          }
        });
      },
    });
  },
}));

export function useMessagesForChat(flag: string) {
  return useChatState(useCallback((s) => s.chats[flag], [flag]));
}
