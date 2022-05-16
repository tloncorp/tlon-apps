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
  ChatWrit,
  ChatWrits,
  DmAction,
  WritDelta,
  WritDiff,
} from '../types/chat';
import api from '../api';
import { whomIsDm } from '../utils';

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

function makeId(ship: string) {
  return `${window.our}/${decToUd(unixToDa(Date.now()).toString())}`;
}

function dmAction(ship: string, delta: WritDelta): Poke<DmAction> {
  return {
    app: 'chat',
    mark: 'dm-action',
    json: {
      ship,
      diff: {
        id: makeId(ship),
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

interface ChatState {
  set: (fn: (sta: ChatState) => void) => void;
  batchSet: (fn: (sta: ChatState) => void) => void;
  chats: {
    [flag: string]: Chat;
  };
  dms: {
    [ship: string]: Chat;
  };
  flags: string[];
  fetchFlags: () => Promise<void>;
  fetchDms: () => Promise<void>;
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

export const useChatState = create<ChatState>((set, get) => ({
  set: (fn) => {
    set(produce(get(), fn));
  },
  batchSet: (fn) => {
    batchUpdates(() => {
      get().set(fn);
    });
  },
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
      // api.poke(chatAction(whom, ));
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
            /* const time = bigInt(udToDec(update.diff.del));
            draft.chats[flag].writs = draft.chats[flag].writs.delete(time); */
          } else if ('add-feel' in update.diff) {
            /* const diff = update.diff['add-feel'];
            const time = bigInt(udToDec(diff.time));
            const writ = draft.chats[flag].writs.get(time);
            writ.seal.feels[diff.ship] = diff.feel;
            draft.chats[flag].writs = draft.chats[flag].writs.set(time, writ); */
          } else if ('add-sects' in update.diff) {
            /* const diff = update.diff['add-sects'];
            const chat = draft.chats[flag];
            chat.perms.writers = [...chat.perms.writers, ...diff]; */
          }
        });
      },
    });
  },
  initializeDm: async (ship: string) => {
    const writs = await api.scry<ChatWrits>({
      app: 'chat',
      path: `/dm/${ship}/writs/newest/100`,
    });
    const perms = {
      writers: [],
    };
    get().batchSet((draft) => {
      const chat = { writs: new BigIntOrderedMap<ChatWrit>(), perms };
      draft.dms[ship] = chat;
      Object.keys(writs).forEach((key) => {
        const writ = writs[key];
        const tim = bigInt(udToDec(key));
        draft.dms[ship].writs = draft.dms[ship].writs.set(tim, writ);
      });
    });

    api.subscribe({
      app: 'chat',
      path: `/dm/${ship}/ui`,
      event: (data: unknown) => {
        const { id, delta } = data as WritDiff;
        get().batchSet((draft) => {
          if ('add' in delta) {
            const time = bigInt(unixToDa(Date.now()));
            const seal = { time: time.toString(), feels: {} };
            const writ = { seal, memo: delta.add };
            draft.dms[ship].writs = draft.dms[ship].writs.set(time, writ);
          } else if ('del' in delta) {
            // TODO: map from rcv -> id
            // const time = bigInt(udToDec(delta.del));
            // draft.dms[ship].writs = draft.dms[ship].writs.delete(time);
          } else if ('add-feel' in delta) {
            /*  see above TODO
             * const d = delta['add-feel'];
            const time = bigInt(udToDec(d.time));
            const writ = draft.dms[ship].writs.get(time);
            writ.seal.feels[d.ship] = d.feel;
            draft.dms[ship].writs = draft.dms[ship].writs.set(time, writ);
            */
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

const selDmList = (s: ChatState) => Object.keys(s.dms);

export function useDmList() {
  return useChatState(selDmList);
}

export function useDmMessages(ship: string) {
  return useChatState(
    useCallback((s) => s.dms[ship]?.writs || new BigIntOrderedMap(), [ship])
  );
}
