import create from "zustand";
import produce, { setAutoFreeze } from "immer";
import api from "../api";
import { ChatUpdate, ChatWrit, ChatWrits, Patda } from "../types/chat";
import { BigIntOrderedMap, daToDate, udToDec, unixToDa } from "@urbit/api";
import bigInt, { BigInteger } from "big-integer";
import { useCallback } from "react";

setAutoFreeze(false);

interface ChatState {
  set: (fn: (sta: ChatState) => void) => void;
  chats: {
    [flag: string]: BigIntOrderedMap<ChatWrit>;
  };
  sendMessage: () => void;
  initialize: (flag: string) => Promise<void>;
}

export function daToBigInt(da: Patda): BigInteger {
  //da = da.slice(1); // rm leading sig
  //const [year, month, day,,hour, min, sec,,millis] = da.split('.');
  const [, , ...millis] = da.slice(1).split("..");
  const mill = console.log(millis);

  const date = daToDate(da);
  console.log(date);
  return unixToDa(date.valueOf());
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
        console.log(update);
        get().set((draft) => {
          if ("add" in update.diff) {
            const time = bigInt(udToDec(update.time));
            const seal = { time: update.time, feel: {} };
            const writ = { seal, memo: update.diff.add };
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
