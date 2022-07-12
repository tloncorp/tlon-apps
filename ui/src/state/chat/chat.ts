import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import { persist } from 'zustand/middleware';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, unixToDa } from '@urbit/api';
import { Poke } from '@urbit/http-api';
import { BigInteger } from 'big-integer';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Chat,
  ChatBriefs,
  ChatBriefUpdate,
  ChatDiff,
  ChatDraft,
  ChatPerm,
  ChatWrit,
  Club,
  ClubAction,
  ClubDelta,
  ClubInvite,
  ClubPin,
  DmAction,
  WritDelta,
} from '../../types/chat';
import api from '../../api';
import {
  createStorageKey,
  clearStorageMigration,
  storageVersion,
  whomIsDm,
  whomIsMultiDm,
} from '../../logic/utils';
import makeWritsStore from './writs';
import { ChatState } from './type';
import clubReducer from './clubReducer';

setAutoFreeze(false);

function chatAction(whom: string, diff: ChatDiff) {
  return {
    app: 'chat',
    mark: 'chat-action',
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

export const useChatState = create<ChatState>(
  persist(
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
      dmArchive: [],
      pacts: {},
      dms: {},
      drafts: {},
      dmSubs: [],
      multiDms: {},
      multiDmSubs: [],
      pendingDms: [],
      pinnedDms: [],
      briefs: {},
      toggleDmPin: async (ship, pin) => {
        get().set((draft) => {
          if (pin) {
            draft.pinnedDms = [...draft.pinnedDms, ship];
          } else {
            draft.pinnedDms = draft.pinnedDms.filter((s) => s !== ship);
          }
        });

        await api.poke({
          app: 'chat',
          mark: 'dm-pin',
          json: {
            ship,
            pin,
          },
        });
      },
      toggleMultiDmPin: async (whom, pin) => {
        get().set((draft) => {
          draft.multiDms[whom].pin = pin;
        });
        await api.poke<ClubPin>({
          app: 'chat',
          mark: 'club-pin',
          json: {
            id: whom,
            pin,
          },
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
        const briefs = await api.scry<ChatBriefs>({
          app: 'chat',
          path: '/briefs',
        });

        get().batchSet((draft) => {
          draft.briefs = briefs;
        });

        const pendingDms = await api.scry<string[]>({
          app: 'chat',
          path: '/dm/invited',
        });
        get().batchSet((draft) => {
          draft.pendingDms = pendingDms;
        });

        try {
          const pinnedDms = await api.scry<string[]>({
            app: 'chat',
            path: '/dm/pinned',
          });
          get().batchSet((draft) => {
            draft.pinnedDms = pinnedDms;
          });
        } catch (error) {
          console.log(error);
        }

        api.subscribe({
          app: 'chat',
          path: '/briefs',
          event: (event: unknown) => {
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
              color: '',
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
              writs: new BigIntOrderedMap<ChatWrit>(),
              perms: {
                writers: [],
              },
              draft: {
                inline: [],
                block: [],
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
        if (isDM) {
          api.poke(dmAction(whom, { add: memo }));
        } else if (isMultiDm) {
          api.poke(
            multiDmAction(whom, {
              writ: {
                id: makeId(),
                delta: { add: { ...memo, sent: Date.now() } },
              },
            })
          );
        } else {
          const id = makeId();
          api.poke(chatWritDiff(whom, id, diff));
        }
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
        await api.poke({
          app: 'chat',
          mark: 'club-create',
          json: {
            id,
            hive,
          },
        });
        get().batchSet((draft) => {
          draft.multiDms[id] = {
            hive,
            team: [window.our],
            meta: {
              title: '',
              description: '',
              image: '',
              color: '',
            },
            pin: false,
          };
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
      },
      initialize: async (whom: string) => {
        if (whom in get().chats) {
          return;
        }

        const perms = await api.scry<ChatPerm>({
          app: 'chat',
          path: `/chat/${whom}/perm`,
        });
        get().batchSet((draft) => {
          const chat = {
            writs: new BigIntOrderedMap<ChatWrit>(),
            perms,
            draft: { block: [], inline: [] },
          };
          draft.chats[whom] = chat;
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
    {
      name: createStorageKey('chat'),
      version: storageVersion,
      migrate: clearStorageMigration,
      partialize: (state) => ({
        multiDms: state.multiDms,
        pinnedDms: state.pinnedDms,
      }),
    }
  )
);

export function useMessagesForChat(whom: string) {
  const def = useMemo(() => new BigIntOrderedMap<ChatWrit>(), []);
  return useChatState(
    useCallback((s) => s.pacts[whom]?.writs || def, [whom, def])
  );
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

export function usePinnedChats() {
  return useChatState(useCallback((s: ChatState) => s.pinnedDms, []));
}

export function usePinnedClubs() {
  const multiDms = useMultiDms();
  return Object.entries(multiDms)
    .filter(([, v]) => v.pin)
    .map(([k]) => k);
}

export function usePinned() {
  const pinnedDms = usePinnedChats();
  const pinnedMultiDms = usePinnedClubs();
  return useMemo(
    () => [...pinnedDms, ...pinnedMultiDms],
    [pinnedDms, pinnedMultiDms]
  );
}
