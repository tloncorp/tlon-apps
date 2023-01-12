import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { Poke } from '@urbit/http-api';
import bigInt, { BigInteger } from 'big-integer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Groups } from '@/types/groups';
import {
  Chat,
  ChatAction,
  ChatBriefs,
  ChatBriefUpdate,
  ChatDiff,
  ChatDraft,
  ChatMemo,
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
import { whomIsDm, whomIsMultiDm, whomIsFlag, nestToFlag } from '@/logic/utils';
import { useChannelFlag } from '@/hooks';
import { useChatStore } from '@/chat/useChatStore';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import { pokeOptimisticallyN, createState } from '../base';
import makeWritsStore, { writsReducer } from './writs';
import { ChatState } from './type';
import clubReducer from './clubReducer';
import { useGroups } from '../groups';
import useSubscriptionState from '../subscription';

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
  const time = Date.now();
  return {
    id: `${window.our}/${decToUd(unixToDa(time).toString())}`,
    time,
  };
}

function dmAction(ship: string, delta: WritDelta, id: string): Poke<DmAction> {
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
    pendingImports: {},
    pins: [],
    sentMessages: [],
    postedMessages: [],
    loadedWrits: {},
    loadedRefs: {},
    briefs: {},
    loadedGraphRefs: {},
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

          const { unread } = useChatStore.getState();
          Object.entries(briefs).forEach(([whom, brief]) => {
            const isUnread = brief.count > 0 && brief['read-id'];
            if (isUnread) {
              unread(whom, brief);
            }
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

          const { read, unread, atBottom, chats, current } =
            useChatStore.getState();
          const isUnread = brief.count > 0 && brief['read-id'];
          if (
            isUnread &&
            current === whom &&
            atBottom &&
            document.visibilityState === 'visible'
          ) {
            get().markRead(whom);
          } else if (isUnread) {
            unread(whom, brief);
          } else if (!isUnread && chats[whom]?.unread?.readTimeout === 0) {
            read(whom);
          }
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
              update: { diff, time },
            } = event;
            const chat = draft.chats[flag];
            const pact = draft.pacts[flag];

            if ('writs' in diff && pact) {
              const { id, delta } = diff.writs;
              const { index, writs } = pact;
              if ('add' in delta) {
                // correct time key in chats
                const timeKey = index[id];
                const writ = timeKey && writs.get(timeKey);

                if (writ) {
                  const newWrits = pact.writs.delete(timeKey);
                  const newTime = bigInt(udToDec(time));
                  draft.pacts[flag].writs = newWrits.set(newTime, writ);
                  draft.pacts[flag].index[id] = newTime;
                }
              }
            } else if ('create' in diff) {
              draft.chats[flag] = diff.create;
            } else if ('del-sects' in diff) {
              chat.perms.writers = chat.perms.writers.filter(
                (w) => !diff['del-sects'].includes(w)
              );
            } else if ('add-sects' in diff) {
              chat.perms.writers = chat.perms.writers.concat(diff['add-sects']);
            }
          });
        },
      });

      const pendingImports = await api.scry<Record<string, boolean>>({
        app: 'chat',
        path: '/imp',
      });

      get().batchSet((draft) => {
        draft.pendingImports = pendingImports;
      });

      api.subscribe({
        app: 'chat',
        path: '/imp',
        event: (imports: Record<string, boolean>) => {
          get().batchSet((draft) => {
            draft.pendingImports = imports;
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
              group: '',
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
    sendMessage: (whom, mem) => {
      const isDM = whomIsDm(whom);
      const isMultiDm = whomIsMultiDm(whom);
      // ensure time and ID match up
      const { id, time } = makeId();
      const memo: ChatMemo = {
        ...mem,
        sent: time,
      };
      const diff = { add: memo };

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
        pokeOptimisticallyN(useChatState, dmAction(whom, delta, id), [
          writsReducer(whom),
        ]).then(() => set((draft) => draft.postedMessages.push(id)));
      } else if (whomIsMultiDm(whom)) {
        pokeOptimisticallyN(
          useChatState,
          multiDmAction(whom, { writ: { id, delta } }),
          [writsReducer(whom)]
        ).then(() => set((draft) => draft.postedMessages.push(id)));
      } else {
        pokeOptimisticallyN(useChatState, chatWritDiff(whom, id, delta), [
          writsReducer(whom),
        ]).then(() => set((draft) => draft.postedMessages.push(id)));
      }
      set((draft) => draft.sentMessages.push(id));
    },
    delFeel: async (whom, id) => {
      const delta: WritDelta = { 'del-feel': window.our };

      if (whomIsDm(whom)) {
        pokeOptimisticallyN(useChatState, dmAction(whom, delta, id), [
          writsReducer(whom),
        ]).then(() => set((draft) => draft.postedMessages.push(id)));
      } else if (whomIsMultiDm(whom)) {
        pokeOptimisticallyN(
          useChatState,
          multiDmAction(whom, { writ: { id, delta } }),
          [writsReducer(whom)]
        ).then(() => set((draft) => draft.postedMessages.push(id)));
      } else {
        pokeOptimisticallyN(useChatState, chatWritDiff(whom, id, delta), [
          writsReducer(whom),
        ]).then(() => set((draft) => draft.postedMessages.push(id)));
      }
    },
    create: async (req) => {
      await new Promise<void>((resolve, reject) => {
        api.poke({
          app: 'chat',
          mark: 'chat-create',
          json: req,
          onError: () => reject(),
          onSuccess: async () => {
            await useSubscriptionState.getState().track('chat/ui', (event) => {
              const { update, flag } = event;
              if (
                'create' in update.diff &&
                flag === `${req.group.split('/')[0]}/${req.name}`
              ) {
                return true;
              }
              return false;
            });
            resolve();
          },
        });
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
    editMultiDm: async (id, meta) =>
      new Promise((resolve, reject) => {
        api.poke({
          ...multiDmAction(id, { meta }),
          onError: () => reject(),
          onSuccess: async () => {
            await useSubscriptionState
              .getState()
              .track(`chat/club/${id}/ui`, (event: ClubDelta) => {
                if ('meta' in event && meta.title === event.meta.title) {
                  return true;
                }

                return false;
              });

            resolve();
          },
        });
      }),
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

      makeWritsStore(
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
  ['chats', 'dms', 'pendingDms', 'briefs', 'multiDms', 'pins'],
  []
);

export function useMessagesForChat(whom: string) {
  const def = useMemo(() => new BigIntOrderedMap<ChatWrit>(), []);
  return useChatState(
    useCallback((s) => s.pacts[whom]?.writs || def, [whom, def])
  );
}

/**
 * @param replying: if set, we're replying to a message
 * @param whom (optional) if provided, overrides the default behavior of using the current channel flag
 * @returns bigInt.BigInteger[] of the ids of the messages for the flag / whom
 */
export function useChatKeys({
  replying,
  whom,
}: {
  replying: boolean;
  whom?: string;
}) {
  const chFlag = useChannelFlag();
  const messages = useMessagesForChat(whom ?? chFlag ?? '');
  return useMemo(
    () =>
      messages
        .keys()
        .reverse()
        .filter((k) => {
          if (replying) {
            return true;
          }
          return messages.get(k)?.memo.replying === null;
        }),
    [messages, replying]
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

const selPacts = (s: ChatState) => s.pacts;
export function usePacts() {
  return useChatState(selPacts);
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

const selChats = (s: ChatState) => s.chats;
export function useChats(): Chats {
  return useChatState(selChats);
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
        const brief = s.briefs[id];
        const isPending = chat && chat.hive.includes(window.our);
        const inTeam = chat && chat.team.includes(window.our);

        if (isPending) {
          return true;
        }

        return !brief && !inTeam;
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

export function useBrief(whom: string) {
  return useChatState(useCallback((s: ChatState) => s.briefs[whom], [whom]));
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

const { shouldLoad, newAttempt, finished } = getPreviewTracker();

const selLoadedRefs = (s: ChatState) => s.loadedRefs;
export function useWritByFlagAndWritId(
  chFlag: string,
  idWrit: string,
  isScrolling: boolean
) {
  const refs = useChatState(selLoadedRefs);
  const path = `/said/${chFlag}/msg/${idWrit}`;
  const cached = refs[path];

  useEffect(() => {
    if (!isScrolling && shouldLoad(path)) {
      newAttempt(path);
      subscribeOnce<UnsubbedWrit>('chat', path)
        .then(({ writ }) => {
          useChatState.getState().batchSet((draft) => {
            draft.loadedRefs[path] = writ;
          });
        })
        .finally(() => finished(path));
    }
  }, [path, isScrolling]);

  return cached;
}

export function useWritByFlagAndGraphIndex(
  chFlag: string,
  index: string,
  isScrolling: boolean
) {
  const res = useChatState(
    useCallback((s) => s.loadedGraphRefs[chFlag + index], [chFlag, index])
  );

  useEffect(() => {
    if (!res && !isScrolling) {
      (async () => {
        let w: ChatWrit | 'error' = 'error';
        try {
          useChatState.getState().batchSet((draft) => {
            draft.loadedGraphRefs[chFlag + index] = 'loading';
          });
          const { writ } = await subscribeOnce(
            'chat',
            `/hook/${chFlag}${index}`
          );
          w = writ;
        } catch (e) {
          console.warn(e);
        }

        useChatState.getState().batchSet((draft) => {
          draft.loadedGraphRefs[chFlag + index] = w;
        });
      })();
    }
  }, [isScrolling, chFlag, index, res]);

  return res || 'loading';
}

export function useLoadedWrits(whom: string) {
  return useChatState(
    useCallback(
      (s) =>
        s.loadedWrits[whom] || {
          oldest: unixToDa(Date.now()),
          newest: unixToDa(0),
        },
      [whom]
    )
  );
}

export function useLatestMessage(chFlag: string) {
  const messages = useMessagesForChat(chFlag);
  return messages.size > 0 ? messages.peekLargest() : [bigInt(), null];
}

export function useGetLatestChat() {
  const def = useMemo(() => new BigIntOrderedMap<ChatWrit>(), []);
  const empty = [bigInt(), null];
  const pacts = usePacts();

  return (chFlag: string) => {
    const pactFlag = chFlag.startsWith('~') ? chFlag : nestToFlag(chFlag)[1];
    const messages = pacts[pactFlag]?.writs ?? def;
    return messages.size > 0 ? messages.peekLargest() : empty;
  };
}

export function useGetFirstUnreadID(whom: string) {
  const keys = useChatKeys({ replying: false, whom });
  const brief = useBrief(whom);
  if (!brief) {
    return null;
  }
  const { 'read-id': lastRead } = brief;
  if (!lastRead) {
    return null;
  }
  // lastRead is formatted like: ~zod/123.456.789...
  const lastReadBN = bigInt(lastRead.split('/')[1].replaceAll('.', ''));
  const firstUnread = keys.find((key) => key.gt(lastReadBN));
  return firstUnread ?? null;
}

(window as any).chat = useChatState.getState;
