import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import { persist } from 'zustand/middleware';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, unixToDa } from '@urbit/api';
import { Poke } from '@urbit/http-api';
import { BigInteger } from 'big-integer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Groups } from '@/types/groups';
import {
  Chat,
  ChatAction,
  ChatBriefs,
  ChatBriefUpdate,
  ChatDiff,
  ChatDraft,
  ChatPerm,
  Chats,
  ChatWrit,
  Club,
  ClubAction,
  ClubDelta,
  ClubInvite,
  DmAction,
  Pins,
  WritDelta,
} from '@/types/chat';
import api from '@/api';
import {
  createStorageKey,
  clearStorageMigration,
  storageVersion,
  whomIsDm,
  whomIsMultiDm,
  whomIsFlag,
} from '@/logic/utils';
import { pokeOptimisticallyN, createState } from '../base';
import makeWritsStore, { writsReducer } from './writs';
import { ChatState, BasedChatState } from './type';
import clubReducer from './clubReducer';
import { useGroups } from '../groups';

setAutoFreeze(false);

function subscribeOnce<T>(app: string, path: string) {
  return new Promise<T>((resolve) => {
    api.subscribe({
      app,
      path,
      event: resolve,
    });
  });
}

function chatAction(whom: string, diff: ChatDiff) {
  return {
    app: 'chat',
    mark: 'chat-action-0',
    json: {
      flag: whom,
      update: {
        time: '',
        diff,
      },
    },
  };
}

function chatWritDiff(whom: string, id: string, delta: WritDelta) {
  return chatAction(whom, {
    writs: {
      id,
      delta,
    },
  });
}

function makeId() {
  return `${window.our}/${decToUd(unixToDa(Date.now()).toString())}`;
}

function dmAction(
  ship: string,
  delta: WritDelta,
  id = makeId()
): Poke<DmAction> {
  return {
    app: 'chat',
    mark: 'dm-action',
    json: {
      ship,
      diff: {
        id,
        delta,
      },
    },
  };
}

function multiDmAction(id: string, delta: ClubDelta): Poke<ClubAction> {
  return {
    app: 'chat',
    mark: 'club-action',
    json: {
      id,
      diff: {
        echo: 0,
        delta,
      },
    },
  };
}

export const useChatState = createState<ChatState>(
  'chat',
  (set, get) => ({
    set: (fn) => {
      set(produce(get(), fn));
    },
    batchSet: (fn) => {
      batchUpdates(() => {
        get().set(fn);
      });
    },
    chats: {},
    dms: {},
    multiDms: {},
    dmArchive: [],
    pacts: {},
    drafts: {},
    chatSubs: [],
    dmSubs: [],
    multiDmSubs: [],
    pendingDms: [],
    pins: [],
    sentMessages: [],
    postedMessages: [],
    briefs: {},
    togglePin: async (whom, pin) => {
      const { pins } = get();
      let newPins = [];

      if (pin) {
        newPins = [...pins, whom];
      } else {
        newPins = pins.filter((w) => w !== whom);
      }

      await api.poke<Pins>({
        app: 'chat',
        mark: 'chat-pins',
        json: {
          pins: newPins,
        },
      });

      get().fetchPins();
    },
    fetchPins: async () => {
      const { pins } = await api.scry<Pins>({
        app: 'chat',
        path: '/pins',
      });

      get().set((draft) => {
        draft.pins = pins;
      });
    },
    markRead: async (whom) => {
      await api.poke({
        app: 'chat',
        mark: 'chat-remark-action',
        json: {
          whom,
          diff: { read: null },
        },
      });
    },
    start: async () => {
      // TODO: parallelise
      api
        .scry<ChatBriefs>({
          app: 'chat',
          path: '/briefs',
        })
        .then((briefs) => {
          get().batchSet((draft) => {
            draft.briefs = briefs;
          });
        });

      api
        .scry<string[]>({
          app: 'chat',
          path: '/dm/invited',
        })
        .then((pendingDms) => {
          get().batchSet((draft) => {
            draft.pendingDms = pendingDms;
          });
        });

      get().fetchPins();

      api
        .scry<Chats>({
          app: 'chat',
          path: '/chats',
        })
        .then((chats) => {
          get().batchSet((draft) => {
            draft.chats = chats;
          });
        });

      api.subscribe({
        app: 'chat',
        path: '/briefs',
        event: (event: unknown, mark: string) => {
          if (mark === 'chat-leave') {
            get().batchSet((draft) => {
              delete draft.briefs[event as string];
            });
            return;
          }

          const { whom, brief } = event as ChatBriefUpdate;
          get().batchSet((draft) => {
            draft.briefs[whom] = brief;
          });
        },
      });
      api.subscribe({
        app: 'chat',
        path: '/dm/invited',
        event: (event: unknown) => {
          get().batchSet((draft) => {
            draft.pendingDms = event as string[];
          });
        },
      });
      api.subscribe({
        app: 'chat',
        path: '/club/new',
        event: (event: ClubInvite) => {
          get().batchSet((draft) => {
            const { id, ...crew } = event;
            const club = draft.multiDms[id];
            if (!club) {
              draft.multiDms[id] = crew;
            }
          });
        },
      });

      api.subscribe({
        app: 'chat',
        path: '/ui',
        event: (event: ChatAction) => {
          get().batchSet((draft) => {
            const {
              flag,
              update: { diff },
            } = event;
            const chat = draft.chats[flag];

            if ('del-sects' in diff) {
              chat.perms.writers = chat.perms.writers.filter(
                (w) => !diff['del-sects'].includes(w)
              );
            } else if ('add-sects' in diff) {
              chat.perms.writers = chat.perms.writers.concat(diff['add-sects']);
            }
          });
        },
      });
    },
    fetchNewer: async (whom: string, count: string) => {
      const isDM = whomIsDm(whom);
      if (isDM) {
        return makeWritsStore(
          whom,
          get,
          `/dm/${whom}/writs`,
          `/dm/${whom}/ui`
        ).getNewer(count);
      }
      return makeWritsStore(
        whom,
        get,
        `/chat/${whom}/writs`,
        `/chat/${whom}/ui/writs`
      ).getNewer(count);
    },
    fetchOlder: async (whom: string, count: string) => {
      const isDM = whomIsDm(whom);
      if (isDM) {
        return makeWritsStore(
          whom,
          get,
          `/dm/${whom}/writs`,
          `/dm/${whom}/ui`
        ).getOlder(count);
      }
      return makeWritsStore(
        whom,
        get,
        `/chat/${whom}/writs`,
        `/chat/${whom}/ui/writs`
      ).getOlder(count);
    },
    fetchMultiDm: async (id, force) => {
      const { multiDms } = get();

      if (multiDms[id] && !force) {
        return multiDms[id];
      }

      const dm = await api.scry<Club>({
        app: 'chat',
        path: `/club/${id}/crew`,
      });

      if (!dm) {
        return {
          hive: [],
          team: [],
          meta: {
            title: '',
            description: '',
            image: '',
            cover: '',
          },
          pin: false,
        };
      }

      set((draft) => {
        draft.multiDms[id] = dm;
      });

      return dm;
    },
    fetchDms: async () => {
      const dms = await api.scry<string[]>({
        app: 'chat',
        path: '/dm',
      });
      get().batchSet((draft) => {
        dms.forEach((ship) => {
          const chat = {
            perms: {
              writers: [],
            },
          };
          draft.dms[ship] = chat;
        });
      });
      const archive = await api.scry<string[]>({
        app: 'chat',
        path: '/dm/archive',
      });
      get().batchSet((draft) => {
        draft.dmArchive = archive;
      });
    },
    unarchiveDm: async (ship) => {
      await api.poke({
        app: 'chat',
        mark: 'dm-unarchive',
        json: ship,
      });
    },
    archiveDm: async (ship) => {
      await api.poke({
        app: 'chat',
        mark: 'dm-archive',
        json: ship,
      });
      get().batchSet((draft) => {
        delete draft.pacts[ship];
        delete draft.dms[ship];
        delete draft.briefs[ship];
      });
    },
    joinChat: async (flag) => {
      await api.poke({
        app: 'chat',
        mark: 'flag',
        json: flag,
      });
    },
    leaveChat: async (flag) => {
      await api.poke({
        app: 'chat',
        mark: 'chat-leave',
        json: flag,
      });
    },
    dmRsvp: async (ship, ok) => {
      get().batchSet((draft) => {
        draft.pendingDms = draft.pendingDms.filter((d) => d !== ship);
        if (!ok) {
          delete draft.pacts[ship];
          delete draft.dms[ship];
          delete draft.briefs[ship];
        }
      });
      await api.poke({
        app: 'chat',
        mark: 'dm-rsvp',
        json: {
          ship,
          ok,
        },
      });
    },
    sendMessage: (whom, memo) => {
      const isDM = whomIsDm(whom);
      const isMultiDm = whomIsMultiDm(whom);
      const diff = { add: memo };
      const id = makeId();
      if (isDM) {
        pokeOptimisticallyN(useChatState, dmAction(whom, { add: memo }, id), [
          writsReducer(whom),
        ]).then(() => set((draft) => draft.postedMessages.push(id)));
      } else if (isMultiDm) {
        pokeOptimisticallyN(
          useChatState,
          multiDmAction(whom, {
            writ: {
              id,
              delta: { add: { ...memo, sent: Date.now() } },
            },
          }),
          [writsReducer(whom)]
        ).then(() => set((draft) => draft.postedMessages.push(id)));
      } else {
        pokeOptimisticallyN(useChatState, chatWritDiff(whom, id, diff), [
          writsReducer(whom),
        ]).then(() => set((draft) => draft.postedMessages.push(id)));
      }
      set((draft) => draft.sentMessages.push(id));
    },
    delMessage: (whom, id) => {
      const isDM = whomIsDm(whom);
      const diff = { del: null };
      if (isDM) {
        api.poke(dmAction(whom, diff, id));
      } else {
        api.poke(chatWritDiff(whom, id, diff));
      }
    },
    addFeel: async (whom, id, feel) => {
      const delta: WritDelta = {
        'add-feel': { feel, ship: window.our },
      };

      if (whomIsDm(whom)) {
        api.poke(dmAction(whom, delta, id));
      } else if (whomIsMultiDm(whom)) {
        api.poke(
          multiDmAction(whom, {
            writ: {
              id,
              delta,
            },
          })
        );
      } else {
        api.poke(chatWritDiff(whom, id, delta));
      }
    },
    delFeel: async (whom, id) => {
      const delta: WritDelta = { 'del-feel': window.our };

      if (whomIsDm(whom)) {
        api.poke(dmAction(whom, delta, id));
      } else if (whomIsMultiDm(whom)) {
        api.poke(
          multiDmAction(whom, {
            writ: {
              id,
              delta,
            },
          })
        );
      } else {
        api.poke(chatWritDiff(whom, id, delta));
      }
    },
    create: async (req) => {
      await api.poke({
        app: 'chat',
        mark: 'chat-create',
        json: req,
      });
    },
    initializeMultiDm: async (id) => {
      if (get().multiDmSubs.includes(id)) {
        return;
      }
      get().batchSet((draft) => {
        draft.multiDmSubs.push(id);
      });
      await makeWritsStore(
        id,
        get,
        `/club/${id}/writs`,
        `/club/${id}/ui/writs`
      ).initialize();

      api.subscribe({
        app: 'chat',
        path: `/club/${id}/ui`,
        event: (event: ClubDelta) => {
          get().batchSet(clubReducer(id, event));
        },
      });
    },
    createMultiDm: async (id, hive) => {
      get().batchSet((draft) => {
        draft.multiDms[id] = {
          hive,
          team: [window.our],
          meta: {
            title: '',
            description: '',
            image: '',
            cover: '',
          },
        };
      });
      await api.poke({
        app: 'chat',
        mark: 'club-create',
        json: {
          id,
          hive,
        },
      });
    },
    editMultiDm: async (id, meta) => {
      await api.poke(multiDmAction(id, { meta }));
    },
    inviteToMultiDm: async (id, hive) => {
      await api.poke(multiDmAction(id, { hive: { ...hive, add: true } }));
    },
    removeFromMultiDm: async (id, hive) => {
      await api.poke(multiDmAction(id, { hive: { ...hive, add: false } }));
    },
    multiDmRsvp: async (id, ok) => {
      await api.poke(multiDmAction(id, { team: { ship: window.our, ok } }));
      await get().fetchMultiDm(id, true);
    },
    addSects: async (whom, sects) => {
      await api.poke(chatAction(whom, { 'add-sects': sects }));
      const perms = await api.scry<ChatPerm>({
        app: 'chat',
        path: `/chat/${whom}/perm`,
      });
      get().batchSet((draft) => {
        draft.chats[whom].perms = perms;
      });
    },
    delSects: async (whom, sects) => {
      await api.poke(chatAction(whom, { 'del-sects': sects }));
      const perms = await api.scry<ChatPerm>({
        app: 'chat',
        path: `/chat/${whom}/perm`,
      });
      get().batchSet((draft) => {
        draft.chats[whom].perms = perms;
      });
    },
    initialize: async (whom: string) => {
      if (get().chatSubs.includes(whom)) {
        return;
      }

      const perms = await api.scry<ChatPerm>({
        app: 'chat',
        path: `/chat/${whom}/perm`,
      });
      get().batchSet((draft) => {
        const chat = { perms };
        draft.chats[whom] = chat;
        draft.chatSubs.push(whom);
      });

      await makeWritsStore(
        whom,
        get,
        `/chat/${whom}/writs`,
        `/chat/${whom}/ui/writs`
      ).initialize();
    },
    getDraft: async (whom) => {
      const chatDraft = await api.scry<ChatDraft>({
        app: 'chat',
        path: `/draft/${whom}`,
      });
      set((draft) => {
        draft.drafts[whom] = chatDraft.story;
      });
    },
    draft: async (whom, story) => {
      api.poke({
        app: 'chat',
        mark: 'chat-draft',
        json: {
          whom,
          story,
        },
      });
    },
    initializeDm: async (ship: string) => {
      if (get().dmSubs.includes(ship)) {
        return;
      }
      get().batchSet((draft) => {
        draft.dmSubs.push(ship);
      });
      await makeWritsStore(
        ship,
        get,
        `/dm/${ship}/writs`,
        `/dm/${ship}/ui`
      ).initialize();
    },
  }),
  ['multiDms', 'pins'],
  []
);

export function useMessagesForChat(whom: string) {
  const def = useMemo(() => new BigIntOrderedMap<ChatWrit>(), []);
  return useChatState(
    useCallback((s) => s.pacts[whom]?.writs || def, [whom, def])
  );
}

export function useIsMessageDelivered(id: string) {
  return useChatState(useCallback((s) => !s.sentMessages.includes(id), [id]));
}

export function useIsMessagePosted(id: string) {
  return useChatState(useCallback((s) => s.postedMessages.includes(id), [id]));
}

const defaultPerms = {
  writers: [],
};

export function useChatPerms(whom: string) {
  return useChatState(
    useCallback((s) => s.chats[whom]?.perms || defaultPerms, [whom])
  );
}

export function useChatIsJoined(whom: string) {
  return useChatState(
    useCallback((s) => Object.keys(s.briefs).includes(whom), [whom])
  );
}

const selDmList = (s: ChatState) =>
  Object.keys(s.briefs)
    .filter((d) => !d.includes('/') && !s.pendingDms.includes(d))
    .sort((a, b) => (s.briefs[b]?.last || 0) - (s.briefs[a]?.last || 0));

export function useDmList() {
  return useChatState(selDmList);
}

export function useDmMessages(ship: string) {
  return useMessagesForChat(ship);
}

export function usePact(whom: string) {
  return useChatState(useCallback((s) => s.pacts[whom], [whom]));
}

export function useCurrentPactSize(whom: string) {
  return useChatState(
    useCallback((s) => s.pacts[whom]?.writs.size ?? 0, [whom])
  );
}

export function useReplies(whom: string, id: string) {
  const pact = usePact(whom);
  return useMemo(() => {
    if (!pact) {
      return new BigIntOrderedMap<ChatWrit>();
    }
    const { writs, index } = pact;
    const time = index[id];
    if (!time) {
      return new BigIntOrderedMap<ChatWrit>();
    }
    const message = writs.get(time);
    const replies = (message?.seal?.replied || ([] as string[]))
      .map((r: string) => {
        const t = pact.index[r];
        const writ = t && writs.get(t);
        return t && writ ? ([t, writ] as const) : undefined;
      })
      .filter((r: unknown): r is [BigInteger, ChatWrit] => !!r);
    return new BigIntOrderedMap<ChatWrit>().gas(replies);
  }, [pact, id]);
}

export function useWrit(whom: string, id: string) {
  return useChatState(
    useCallback(
      (s) => {
        const pact = s.pacts[whom];
        if (!pact) {
          return undefined;
        }
        const time = pact.index[id];
        if (!time) {
          return undefined;
        }
        return [time, pact.writs.get(time)] as const;
      },
      [whom, id]
    )
  );
}

export function useChat(whom: string): Chat | undefined {
  return useChatState(useCallback((s) => s.chats[whom], [whom]));
}

export function useChatDraft(whom: string) {
  return useChatState(
    useCallback(
      (s) =>
        s.drafts[whom] || {
          inline: [],
          block: [],
        },
      [whom]
    )
  );
}

const selPendingDms = (s: ChatState) => s.pendingDms;
export function usePendingDms() {
  return useChatState(selPendingDms);
}

export function useDmIsPending(ship: string) {
  return useChatState(useCallback((s) => s.pendingDms.includes(ship), [ship]));
}

const selMultiDms = (s: ChatState) => s.multiDms;
export function useMultiDms() {
  return useChatState(selMultiDms);
}

export function useMultiDm(id: string): Club | undefined {
  const multiDm = useChatState(useCallback((s) => s.multiDms[id], [id]));

  useEffect(() => {
    useChatState.getState().fetchMultiDm(id);
  }, [id]);

  return multiDm;
}

export function usePendingMultiDms() {
  const multiDms = useChatState(selMultiDms);

  return Object.entries(multiDms)
    .filter(([, value]) => value.hive.includes(window.our))
    .map(([key]) => key);
}

export function useMultiDmIsPending(id: string): boolean {
  return useChatState(
    useCallback(
      (s) => {
        const chat = s.multiDms[id];
        if (!chat) {
          return false;
        }

        return chat.hive.includes(window.our);
      },
      [id]
    )
  );
}

export function useMultiDmMessages(id: string) {
  return useMessagesForChat(id);
}

const selDmArchive = (s: ChatState) => s.dmArchive;
export function useDmArchive() {
  return useChatState(selDmArchive);
}

export function isGroupBrief(brief: string) {
  return brief.includes('/');
}

export function useBriefs() {
  return useChatState(useCallback((s: ChatState) => s.briefs, []));
}

export function usePinned() {
  return useChatState(useCallback((s: ChatState) => s.pins, []));
}

export function usePinnedGroups() {
  const groups = useGroups();
  const pinned = usePinned();
  return useMemo(
    () =>
      pinned.filter(whomIsFlag).reduce(
        (memo, flag) =>
          flag in groups
            ? {
                ...memo,
                [flag]: groups[flag],
              }
            : memo,
        {} as Groups
      ),
    [groups, pinned]
  );
}

export function usePinnedDms() {
  const pinned = usePinned();
  return useMemo(() => pinned.filter(whomIsDm), [pinned]);
}

export function usePinnedClubs() {
  const pinned = usePinned();
  return useMemo(() => pinned.filter(whomIsMultiDm), [pinned]);
}

type UnsubbedWrit = {
  flag: string;
  writ: ChatWrit;
};

export function useWritByFlagAndWritId(chFlag: string, idWrit: string) {
  const [res, setRes] = useState(null as UnsubbedWrit | null);
  useEffect(() => {
    subscribeOnce<UnsubbedWrit>('chat', `/said/${chFlag}/msg/${idWrit}`).then(
      setRes
    );
    return () => {
      setRes(null);
    };
  }, [chFlag, idWrit]);
  return res;
}

(window as any).chat = useChatState.getState;
