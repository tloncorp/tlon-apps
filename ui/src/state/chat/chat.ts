import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { Poke, SubscriptionInterface } from '@urbit/http-api';
import bigInt from 'big-integer';
import { useCallback, useMemo } from 'react';
import {
  Chat,
  ChatDiff,
  ChatMemo,
  ChatPerm,
  ChatUpdate,
  ChatWhom,
  ChatWrit,
  ChatWrits,
  DmAction,
  WritDelta,
  WritDiff,
} from '../../types/chat';
import api from '../../api';
import { whomIsDm } from '../../utils';
import makeWritsStore from './writs';
import { ChatState } from './type';

setAutoFreeze(false);

interface ChatApi {
  newest: (flag: string, count: number) => Promise<ChatWrit[]>;
  subscribe: (flag: string, opts: SubscriptionInterface) => Promise<number>;
  delMessage: (flag: string, time: string) => Promise<number>;
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

function chatWritDiff(flag: string, id: string, delta: WritDelta) {
  return chatAction(flag, {
    writs: {
      id,
      delta,
    },
  });
}

function makeId() {
  return `${window.our}/${decToUd(unixToDa(Date.now()).toString())}`;
}

function dmAction(ship: string, delta: WritDelta): Poke<DmAction> {
  return {
    app: 'chat',
    mark: 'dm-action',
    json: {
      ship,
      diff: {
        id: makeId(),
        delta,
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
  delMessage: (flag, idx) => api.poke(chatWritDiff(flag, idx, { del: null })),
};

export const useChatState = create<ChatState>((set, get) => ({
  set: (fn) => {
    set(produce(get(), fn));
  },
  batchSet: (fn) => {
    batchUpdates(() => {
      get().set(fn);
    });
  },
  writs: {},
  dms: {},
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
  fetchDms: async () => {
    const dms = await api.scry<string[]>({
      app: 'chat',
      path: '/dm',
    });
    get().batchSet((draft) => {
      dms.forEach((ship) => {
        const chat = {
          writs: new BigIntOrderedMap<ChatWrit>(),
          perms: {
            writers: [],
          },
        };
        draft.dms[ship] = chat;
      });
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
  sendMessage: (whom, memo) => {
    const isDM = whomIsDm(whom);
    const diff = { add: memo };
    if (isDM) {
      api.poke(dmAction(whom, { add: memo }));
    } else {
      const id = makeId();
      api.poke(chatWritDiff(whom, id, diff));
    }
  },
  delMessage: (flag, time) => {
    chatApi.delMessage(flag, time);
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
    get().batchSet((draft) => {
      const chat = { writs: new BigIntOrderedMap<ChatWrit>(), perms };
      draft.chats[flag] = chat;
    });
    await makeWritsStore(
      flag,
      get,
      `/chat/${flag}/writs`,
      `/chat/${flag}/ui/writs`
    ).initialize();
  },
  initializeDm: async (ship: string) => {
    const perms = {
      writers: [],
    };
    get().batchSet((draft) => {
      const chat = { writs: new BigIntOrderedMap<ChatWrit>(), perms };
    });
    await makeWritsStore(
      ship,
      get,
      `/dm/${ship}/writs`,
      `/dm/${ship}/ui`
    ).initialize();
  },
}));

export function useMessagesForChat(whom: string) {
  const def = useMemo(() => new BigIntOrderedMap<ChatWrit>(), []);
  return useChatState(useCallback((s) => s.writs[whom] || def, [whom, def]));
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

const selDmList = (s: ChatState) => Object.keys(s.dms);

export function useDmList() {
  return useChatState(selDmList);
}

export function useDmMessages(ship: string) {
  return useMessagesForChat(ship);
}

window.chat = useChatState.getState;
