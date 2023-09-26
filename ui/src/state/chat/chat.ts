import _ from 'lodash';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce, { setAutoFreeze } from 'immer';
import { SetState } from 'zustand';
import { Poke } from '@urbit/http-api';
import { formatUd, parseUd, unixToDa } from '@urbit/aura';
import { udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useCallback, useEffect, useMemo } from 'react';
import { Groups } from '@/types/groups';
import {
  DMBriefUpdate,
  ChatScan,
  Club,
  ClubAction,
  ClubDelta,
  Clubs,
  DmAction,
  DMBriefs,
  newWritMap,
  Pact,
  Pins,
  WritDelta,
  Writ,
  Patda,
  WritEssay,
  WritInCache,
} from '@/types/dms';
import {
  newQuipMap,
  Note,
  NoteEssay,
  Quip,
  Quips,
  ShelfAction,
} from '@/types/channel';
import api from '@/api';
import {
  whomIsDm,
  whomIsMultiDm,
  whomIsFlag,
  nestToFlag,
  whomIsNest,
} from '@/logic/utils';
import { useChatStore } from '@/chat/useChatStore';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { getWindow } from '@/logic/windows';
import queryClient from '@/queryClient';
import { useMutation } from '@tanstack/react-query';
import { createState } from '../base';
import makeWritsStore, { writsReducer } from './writs';
import { BasedChatState, ChatState } from './type';
import clubReducer from './clubReducer';
import { useGroups } from '../groups';
import { channelAction } from '../channel/channel';

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

function makeId() {
  const time = Date.now();
  return {
    id: `${window.our}/${formatUd(unixToDa(time))}`,
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
    mark: 'club-action-0',
    json: {
      id,
      diff: {
        uid: '0v3',
        delta,
      },
    },
  };
}

async function optimisticAction(
  whom: string,
  id: string,
  delta: WritDelta,
  set: SetState<BasedChatState>
) {
  const action: Poke<DmAction | ClubAction> = whomIsDm(whom)
    ? dmAction(whom, delta as WritDelta, id)
    : multiDmAction(whom, { writ: { id, delta: delta as WritDelta } });

  set((draft) => {
    const potentialEvent =
      action.mark === 'club-action-0' &&
      'id' in action.json &&
      'writ' in action.json.diff.delta
        ? action.json.diff.delta.writ
        : (action.json as DmAction);
    const reduced = writsReducer(whom, true)(potentialEvent, draft);

    return {
      pacts: { ...reduced.pacts },
      writWindows: { ...reduced.writWindows },
    };
  });

  await api.poke<ClubAction | DmAction | ShelfAction>(action);
}

export const useChatState = createState<ChatState>(
  'chat',
  (set, get) => ({
    batchSet: (fn) => {
      batchUpdates(() => {
        set(produce(fn));
      });
    },
    dms: [],
    multiDms: {},
    dmArchive: [],
    pacts: {},
    pendingDms: [],
    pins: [],
    trackedMessages: [],
    writWindows: {},
    loadedRefs: {},
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
    markDmRead: async (whom) => {
      if (whomIsNest(whom)) {
        await api.poke(channelAction(whom, { read: null }));
      } else {
        await api.poke({
          app: 'chat',
          mark: 'chat-remark-action',
          json: {
            whom,
            diff: { read: null },
          },
        });
      }
    },
    start: async ({ dms, clubs, briefs, pins, invited }) => {
      get().batchSet((draft) => {
        draft.pins = pins;
        draft.multiDms = clubs;
        draft.dms = dms;
        draft.pendingDms = invited;
        draft.pins = pins;
      });

      useChatStore.getState().update(briefs);

      api.subscribe(
        {
          app: 'chat',
          path: '/dm/invited',
          event: (event: unknown) => {
            get().batchSet((draft) => {
              draft.pendingDms = event as string[];
            });
          },
        },
        3
      );
      api.subscribe(
        {
          app: 'chat',
          path: '/clubs/ui',
          event: (event: ClubAction) => {
            get().batchSet(clubReducer(event));
          },
        },
        3
      );
    },
    fetchMessages: async (whom: string, count: string, dir, time) => {
      const isDM = whomIsDm(whom);
      const type = isDM ? 'dm' : 'club';

      const { getOlder, getNewer } = makeWritsStore(
        whom,
        get,
        set,
        `/${type}/${whom}/writs`,
        `/${type}/${whom}/ui${isDM ? '' : '/writs'}`
      );

      if (dir === 'older') {
        return getOlder(count, time);
      }

      return getNewer(count, time);
    },
    fetchMessagesAround: async (whom: string, count: string, time) => {
      const isDM = whomIsDm(whom);
      const type = isDM ? 'dm' : 'club';

      return makeWritsStore(
        whom,
        get,
        set,
        `/${type}/${whom}/writs`,
        `/${type}/${whom}/ui${isDM ? '' : '/writs'}`
      ).getAround(count, time);
    },
    fetchMultiDms: async () => {
      const dms = await api.scry<Clubs>({
        app: 'chat',
        path: '/clubs',
      });

      get().batchSet((draft) => {
        draft.multiDms = dms;
      });
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
        draft.dms = dms;
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
      queryClient.setQueryData(
        ['dm', 'briefs'],
        (briefs: DMBriefs | undefined) => {
          if (!briefs) {
            return briefs;
          }

          const newBriefs = { ...briefs };

          delete newBriefs[ship];

          return newBriefs;
        }
      );
      get().batchSet((draft) => {
        delete draft.pacts[ship];
        draft.dms = draft.dms.filter((s) => s !== ship);
      });
    },
    dmRsvp: async (ship, ok) => {
      get().batchSet((draft) => {
        draft.pendingDms = draft.pendingDms.filter((d) => d !== ship);
        if (!ok) {
          delete draft.pacts[ship];
          queryClient.setQueryData(
            ['dm', 'briefs'],
            (briefs: DMBriefs | undefined) => {
              if (!briefs) {
                return briefs;
              }

              if (!ok) {
                const newBriefs = { ...briefs };

                delete newBriefs[ship];

                return newBriefs;
              }

              return briefs;
            }
          );
          draft.dms = draft.dms.filter((s) => s !== ship);
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
    sendMessage: async (whom, mem, replying) => {
      const isDM = whomIsDm(whom);
      // ensure time and ID match up
      const { id, time } = makeId();
      const memo: Omit<NoteEssay, 'han-data'> = {
        content: mem.content,
        author: mem.author,
        sent: time,
      };
      let diff: WritDelta;

      if (!replying) {
        diff = {
          add: {
            memo,
            kind: null,
            time: null,
          },
        };
      } else {
        diff = {
          quip: {
            id,
            meta: null,
            delta: {
              add: {
                memo,
                time: null,
              },
            },
          },
        };

        queryClient.setQueryData(
          ['dms', whom, replying],
          (writ: WritInCache | undefined) => {
            if (!writ) {
              return writ;
            }

            const prevQuips = writ.seal.quips || {};
            const quips: Quips = {};

            Object.entries(prevQuips).forEach(([k, v]) => {
              quips[k] = v;
            });

            const quipId = unixToDa(memo.sent).toString();

            const newQuip: Quip = {
              cork: {
                id: quipId,
                feels: {},
              },
              memo,
            };

            quips[quipId] = newQuip;

            return {
              ...writ,
              seal: {
                ...writ.seal,
                quips: quips as Quips,
              },
            };
          }
        );
      }

      const { pacts } = get();
      const isNew = !(whom in pacts);
      get().batchSet((draft) => {
        if (isDM) {
          if (isNew) {
            draft.dms.push(whom);
            draft.pacts[whom] = { index: {}, writs: newWritMap() };

            return;
          }
        }

        draft.trackedMessages.push({ id, status: 'pending' });
      });

      if (replying) {
        await optimisticAction(whom, replying, diff, set);
      } else {
        await optimisticAction(whom, id, diff, set);
      }
      set((draft) => {
        if (!isDM || !isNew) {
          draft.trackedMessages.map((msg) => {
            if (msg.id === id) {
              return { status: 'sent', id };
            }

            return msg;
          });
        }
      });
    },
    delDm: async (whom, id) => {
      const diff = { del: null };
      if (whomIsDm(whom)) {
        await api.trackedPoke<DmAction, DmAction>(
          dmAction(whom, diff, id),
          { app: 'chat', path: whom },
          (event) => event.ship === id && 'del' in event.diff
        );
      } else {
        await api.trackedPoke<ClubAction>(
          multiDmAction(whom, { writ: { id, delta: diff } }),
          { app: 'chat', path: whom }
        );
      }
    },
    addFeelToDm: async (whom, id, feel) => {
      const delta: WritDelta = {
        'add-feel': { feel, ship: window.our },
      };
      await optimisticAction(whom, id, delta, set);
    },
    delFeelToDm: async (whom, id) => {
      const delta: WritDelta = { 'del-feel': window.our };
      await optimisticAction(whom, id, delta, set);
    },
    initializeMultiDm: async (id) => {
      await makeWritsStore(
        id,
        get,
        set,
        `/club/${id}/writs`,
        `/club/${id}/ui/writs`
      ).initialize();
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
      api.trackedPoke<ClubAction>(
        multiDmAction(id, { meta }),
        {
          app: 'chat',
          path: `/clubs/ui`,
        },
        (event) =>
          'meta' in event.diff.delta &&
          meta.title === event.diff.delta.meta.title
      ),
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
    initialize: async (whom: string) => {
      await makeWritsStore(
        whom,
        get,
        set,
        `/chat/${whom}/writs`,
        `/chat/${whom}/ui/writs`
      ).initialize();
    },
    initializeDm: async (ship: string) => {
      await makeWritsStore(
        ship,
        get,
        set,
        `/dm/${ship}/writs`,
        `/dm/${ship}/ui`
      ).initialize();
    },
  }),
  {
    partialize: (state) => {
      const saved = _.pick(state, ['dms', 'pendingDms', 'multiDms', 'pins']);

      return saved;
    },
  },
  []
);

export function useWritWindow(whom: string, time?: string) {
  const window = useChatState(useCallback((s) => s.writWindows[whom], [whom]));

  return getWindow(window, time);
}

const emptyWrits = newWritMap();
export function useMessagesForChat(whom: string, near?: string) {
  const window = useWritWindow(whom, near);
  const writs = useChatState(useCallback((s) => s.pacts[whom]?.writs, [whom]));

  return useMemo(() => {
    return window && writs
      ? newWritMap(writs.getRange(window.oldest, window.newest, true))
      : writs || emptyWrits;
  }, [writs, window]);
}

export function useHasMessages(whom: string) {
  const messages = useMessagesForChat(whom);
  return messages.size > 0;
}

/**
 * @param replying: if set, we're replying to a message
 * @param whom (optional) if provided, overrides the default behavior of using the current channel flag
 * @returns bigInt.BigInteger[] of the ids of the messages for the flag / whom
 */
export function useChatKeys({ whom }: { replying: boolean; whom: string }) {
  const messages = useMessagesForChat(whom ?? '');
  return useMemo(() => Array.from(messages.keys()), [messages]);
}

export function useTrackedMessageStatus(id: string) {
  return useChatState(
    useCallback(
      (s) => s.trackedMessages.find((m) => m.id === id)?.status || 'delivered',
      [id]
    )
  );
}

const emptyBriefs: DMBriefs = {};
export function useDmBriefs() {
  const { data, ...query } = useReactQuerySubscription<DMBriefs, DMBriefUpdate>(
    {
      queryKey: ['dm', 'briefs'],
      app: 'chat',
      path: '/briefs',
      scry: '/briefs',
    }
  );

  if (!data) {
    return {
      ...query,
      data: emptyBriefs,
    };
  }

  return {
    ...query,
    data,
  };
}

export function useDmBrief(whom: string) {
  const briefs = useDmBriefs();
  return briefs.data[whom];
}

export function useChatLoading(whom: string) {
  const brief = useDmBrief(whom);

  return useChatState(
    useCallback((s) => !s.pacts[whom] && !!brief, [whom, brief])
  );
}

const emptyPact = { index: {}, writs: newWritMap() };
export function usePact(whom: string): Pact {
  return useChatState(useCallback((s) => s.pacts[whom] || emptyPact, [whom]));
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

export function useWrit(whom: string, writId: string, disabled = false) {
  const queryKey = useMemo(() => ['dms', whom, writId], [whom, writId]);

  const path = useMemo(() => {
    const suffix = `/writs/writ/id/${writId}`;
    if (whomIsDm(whom)) {
      return `/dm/${whom}${suffix}`;
    }

    return `/club/${whom}${suffix}`;
  }, [writId, whom]);

  const enabled = useMemo(
    () => writId !== '0' && !disabled,
    [writId, disabled]
  );
  const { data, ...rest } = useReactQueryScry<Writ>({
    queryKey,
    app: 'chat',
    path,
    options: {
      enabled,
    },
  });

  return useMemo(() => {
    if (!data) {
      return {
        writ: undefined,
        ...rest,
      };
    }

    const writ = data;
    const quips = (writ.seal.quips || {}) as Quips;

    const diff: [BigInteger, Quip][] = Object.entries(quips).map(([k, v]) => [
      bigInt(udToDec(k)),
      v as Quip,
    ]);

    const quipMap = newQuipMap(diff);

    const writWithQuips: Writ = {
      ...writ,
      seal: {
        ...writ.seal,
        quips: quipMap,
      },
    };

    return {
      writ: writWithQuips,
      ...rest,
    };
  }, [data, rest]);
}

export function useDeleteDMQuipMutation() {
  const mutationFn = async (variables: {
    whom: string;
    writId: string;
    quipId: string;
  }) => {
    const delta: WritDelta = {
      quip: {
        id: variables.quipId,
        meta: null,
        delta: {
          del: null,
        },
      },
    };

    const action: Poke<DmAction | ClubAction> = whomIsDm(variables.whom)
      ? dmAction(variables.whom, delta as WritDelta, variables.writId)
      : multiDmAction(variables.whom, {
          writ: { id: variables.writId, delta: delta as WritDelta },
        });

    await api.poke<ClubAction | DmAction | ShelfAction>(action);
  };

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      queryClient.setQueryData(
        ['dms', variables.whom, variables.writId],
        (writ: WritInCache | undefined) => {
          if (!writ) {
            return writ;
          }

          const prevQuips = writ.seal.quips || {};
          const quips: Quips = {};

          Object.entries(prevQuips).forEach(([k, v]) => {
            quips[k] = v;
          });

          const quip = Object.values(quips).find(
            (q) => q.cork.id === variables.quipId
          );

          if (!quip) {
            return writ;
          }

          let time = '';

          Object.entries(quips).forEach(([k, v]) => {
            if (v.cork.id === variables.quipId) {
              time = k;
            }
          });

          delete quips[time];

          return {
            ...writ,
            seal: {
              ...writ.seal,
              quips: quips as Quips,
            },
          };
        }
      );
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries(['dms', variables.whom, variables.writId]);
    },
  });
}

export function useAddDMQuipFeelMutation() {
  const mutationFn = async (variables: {
    whom: string;
    writId: string;
    quipId: string;
    feel: string;
  }) => {
    const delta: WritDelta = {
      quip: {
        id: variables.quipId,
        meta: null,
        delta: {
          'add-feel': { feel: variables.feel, ship: window.our },
        },
      },
    };

    console.log({ delta });

    const action: Poke<DmAction | ClubAction> = whomIsDm(variables.whom)
      ? dmAction(variables.whom, delta as WritDelta, variables.writId)
      : multiDmAction(variables.whom, {
          writ: { id: variables.writId, delta: delta as WritDelta },
        });

    await api.poke<ClubAction | DmAction | ShelfAction>(action);
  };

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      queryClient.setQueryData(
        ['dms', variables.whom, variables.writId],
        (writ: WritInCache | undefined) => {
          if (!writ) {
            return writ;
          }

          const prevQuips = writ.seal.quips || {};
          const quips: Quips = {};

          Object.entries(prevQuips).forEach(([k, v]) => {
            quips[k] = v;
          });

          const quip = Object.values(quips).find(
            (q) => q.cork.id === variables.quipId
          );

          if (!quip) {
            return writ;
          }

          let time = '';

          Object.entries(quips).forEach(([k, v]) => {
            if (v.cork.id === variables.quipId) {
              time = k;
            }
          });

          const newQuip: Quip = {
            ...quip,
            cork: {
              ...quip.cork,
              feels: {
                ...quip.cork.feels,
                [window.our]: variables.feel,
              },
            },
          };

          quips[time] = newQuip;

          return {
            ...writ,
            seal: {
              ...writ.seal,
              quips: quips as Quips,
            },
          };
        }
      );
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries(['dms', variables.whom, variables.writId]);
    },
  });
}

export function useDeleteDMQuipFeelMutation() {
  const mutationFn = async (variables: {
    whom: string;
    writId: string;
    quipId: string;
  }) => {
    const delta: WritDelta = {
      quip: {
        id: variables.quipId,
        meta: null,
        delta: {
          'del-feel': window.our,
        },
      },
    };

    const action: Poke<DmAction | ClubAction> = whomIsDm(variables.whom)
      ? dmAction(variables.whom, delta as WritDelta, variables.writId)
      : multiDmAction(variables.whom, {
          writ: { id: variables.writId, delta: delta as WritDelta },
        });

    await api.poke<ClubAction | DmAction | ShelfAction>(action);
  };

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      queryClient.setQueryData(
        ['dms', variables.whom, variables.writId],
        (writ: WritInCache | undefined) => {
          if (!writ) {
            return writ;
          }

          const prevQuips = writ.seal.quips || {};
          const quips: Quips = {};

          Object.entries(prevQuips).forEach(([k, v]) => {
            quips[k] = v;
          });

          const quip = Object.values(quips).find(
            (q) => q.cork.id === variables.quipId
          );

          if (!quip) {
            return writ;
          }

          let time = '';

          Object.entries(quips).forEach(([k, v]) => {
            if (v.cork.id === variables.quipId) {
              time = k;
            }
          });

          const currentFeels = quip.cork.feels;

          delete currentFeels[window.our];

          const newQuip: Quip = {
            ...quip,
            cork: {
              ...quip.cork,
              feels: {
                ...currentFeels,
              },
            },
          };

          quips[time] = newQuip;

          return {
            ...writ,
            seal: {
              ...writ.seal,
              quips: quips as Quips,
            },
          };
        }
      );
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries(['dms', variables.whom, variables.writId]);
    },
  });
}

export function useIsDmUnread(whom: string) {
  const { data: briefs } = useDmBriefs();
  const brief = briefs[whom];
  return Boolean(brief?.count > 0 && brief['read-id']);
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

const selDms = (s: ChatState) => s.dms;
export function useDms() {
  return useChatState(selDms);
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
  const brief = useDmBrief(id);
  return useChatState(
    useCallback(
      (s) => {
        const chat = s.multiDms[id];
        const isPending = chat && chat.hive.includes(window.our);
        const inTeam = chat && chat.team.includes(window.our);

        if (isPending) {
          return true;
        }

        return !brief && !inTeam;
      },
      [id, brief]
    )
  );
}

const selDmArchive = (s: ChatState) => s.dmArchive;
export function useDmArchive() {
  return useChatState(selDmArchive);
}

export function isGroupBrief(brief: string) {
  return brief.includes('/');
}

// export function useBrief(whom: string) {
// return useChatState(useCallback((s: ChatState) => s.briefs[whom], [whom]));
// }

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
          groups && flag in groups
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
  writ: Note;
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
  const pact = usePact(chFlag);
  const writIndex = pact && pact.index[idWrit];
  const writInPact = writIndex && pact && pact.writs.get(writIndex);

  useEffect(() => {
    if (!isScrolling && !writInPact && shouldLoad(path)) {
      newAttempt(path);
      subscribeOnce<UnsubbedWrit>('chat', path)
        .then(({ writ }) => {
          useChatState.getState().batchSet((draft) => {
            draft.loadedRefs[path] = writ;
          });
        })
        .finally(() => finished(path));
    }
  }, [path, isScrolling, writInPact]);

  if (writInPact) {
    return writInPact;
  }

  return cached;
}

export function useGetFirstDMUnreadID(whom: string) {
  const keys = useChatKeys({ replying: false, whom });
  const brief = useDmBrief(whom);
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

export function useChatSearch(whom: string, query: string) {
  const type = whomIsDm(whom) ? 'dm' : whomIsMultiDm(whom) ? 'club' : 'chat';
  const { data, ...rest } = useReactQueryScry<ChatScan>({
    queryKey: ['chat', 'search', whom, query],
    app: 'chat',
    path: `/${type}/${whom}/search/text/0/1.000/${query}`,
    options: {
      enabled: query !== '',
    },
  });

  const scan = useMemo(() => {
    return newWritMap(
      (data || []).map(({ time, writ }) => [bigInt(parseUd(time)), writ]),
      true
    );
  }, [data]);

  return {
    scan,
    ...rest,
  };
}

(window as any).chat = useChatState.getState;
