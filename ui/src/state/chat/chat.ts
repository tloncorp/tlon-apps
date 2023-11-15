import _ from 'lodash';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce, { setAutoFreeze } from 'immer';
import { SetState } from 'zustand';
import { Poke } from '@urbit/http-api';
import { formatUd, unixToDa } from '@urbit/aura';
import { udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Groups } from '@/types/groups';
import {
  DMUnreadUpdate,
  Club,
  ClubAction,
  ClubDelta,
  Clubs,
  DmAction,
  DMUnreads,
  newWritMap,
  Pact,
  Pins,
  WritDelta,
  Writ,
  WritInCache,
  ChatUIEvent,
  ToggleMessage,
  HiddenMessages,
  BlockedByShips,
  BlockedShips,
  WritResponse,
  WritDiff,
} from '@/types/dms';
import {
  Post,
  PostEssay,
  Reply,
  Replies,
  ChannelsAction,
  ReplyTuple,
} from '@/types/channel';
import api from '@/api';
import { whomIsDm, whomIsMultiDm, whomIsFlag, whomIsNest } from '@/logic/utils';
import { useChatStore } from '@/chat/useChatStore';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { getWindow } from '@/logic/windows';
import queryClient from '@/queryClient';
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

function getActionAndEvent(
  whom: string,
  id: string,
  delta: WritDelta
): OptimisticAction {
  if (whomIsDm(whom)) {
    const action = dmAction(whom, delta, id);
    return {
      action,
      event: action.json.diff,
    };
  }

  const diff: WritDiff = { id, delta };
  return {
    action: multiDmAction(whom, { writ: diff }),
    event: diff,
  };
}

interface OptimisticAction {
  action: Poke<DmAction | ClubAction>;
  event: WritDiff | WritResponse;
}

async function optimisticAction(
  whom: string,
  id: string,
  delta: WritDelta,
  set: SetState<BasedChatState>
) {
  const { action, event } = getActionAndEvent(whom, id, delta);
  set((draft) => {
    const reduced = writsReducer(whom, true)(event, draft);

    return {
      pacts: { ...reduced.pacts },
      writWindows: { ...reduced.writWindows },
    };
  });

  await api.poke<ClubAction | DmAction | ChannelsAction>(action);
}

function resolveHiddenMessages(toggle: ToggleMessage) {
  const hiding = 'hide' in toggle;
  return (prev: HiddenMessages | undefined) => {
    if (!prev) {
      return hiding ? [toggle.hide] : [];
    }

    return hiding
      ? [...prev, toggle.hide]
      : prev.filter((id) => id !== toggle.show);
  };
}

function getStore(
  whom: string,
  get: () => BasedChatState,
  set: SetState<BasedChatState>
) {
  const isDM = whomIsDm(whom);
  const type = isDM ? 'dm' : whomIsMultiDm(whom) ? 'club' : 'chat';

  return makeWritsStore(
    whom,
    get,
    set,
    `/${type}/${whom}/writs`,
    `/${type}/${whom}${isDM ? '' : '/writs'}`
  );
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
    start: async ({ dms, clubs, unreads, pins, invited }) => {
      get().batchSet((draft) => {
        draft.pins = pins;
        draft.multiDms = clubs;
        draft.dms = dms;
        draft.pendingDms = invited;
        draft.pins = pins;
      });

      useChatStore.getState().update(unreads);

      api.subscribe(
        {
          app: 'chat',
          path: '/',
          event: (event: ChatUIEvent, mark) => {
            if (mark === 'chat-toggle-message') {
              const toggle = event as ToggleMessage;
              queryClient.setQueryData<HiddenMessages>(
                ['chat', 'hidden'],
                resolveHiddenMessages(toggle)
              );
            }

            if ('blocked-by' in event) {
              queryClient.setQueryData<BlockedByShips>(
                ['chat', 'blocked-by'],
                (prev) => {
                  if (!prev) {
                    return [event['blocked-by']];
                  }

                  return [...prev, event['blocked-by']];
                }
              );
            }

            if ('unblocked-by' in event) {
              queryClient.setQueryData<BlockedByShips>(
                ['chat', 'blocked-by'],
                (prev) => {
                  if (!prev) {
                    return [];
                  }

                  return prev.filter((s) => s !== event['unblocked-by']);
                }
              );
            }
          },
        },
        3
      );

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
          path: '/clubs',
          event: (event: ClubAction) => {
            get().batchSet(clubReducer(event));
          },
        },
        3
      );
    },
    fetchMessages: async (whom: string, count: string, dir, time) => {
      const { getOlder, getNewer } = getStore(whom, get, set);

      if (dir === 'older') {
        return getOlder(count, time);
      }

      return getNewer(count, time);
    },
    fetchMessagesAround: async (whom, count, timeOrId) => {
      const store = getStore(whom, get, set);

      return store.getAround(count, timeOrId);
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
        ['dm', 'unreads'],
        (unreads: DMUnreads | undefined) => {
          if (!unreads) {
            return unreads;
          }

          const newUnreads = { ...unreads };

          delete newUnreads[ship];

          return newUnreads;
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
            ['dm', 'unreads'],
            (unreads: DMUnreads | undefined) => {
              if (!unreads) {
                return unreads;
              }

              if (!ok) {
                const newUnreads = { ...unreads };

                delete newUnreads[ship];

                return newUnreads;
              }

              return unreads;
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
      const memo: Omit<PostEssay, 'kind-data'> = {
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
          reply: {
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

            const prevReplies = writ.seal.replies || {};
            const replies: Replies = {};

            Object.entries(prevReplies).forEach(([k, v]) => {
              replies[k] = v;
            });

            const replyId = unixToDa(memo.sent).toString();

            const newReply: Reply = {
              seal: {
                id: replyId,
                'parent-id': replying,
                reacts: {},
              },
              memo,
            };

            replies[replyId] = newReply;

            return {
              ...writ,
              seal: {
                ...writ.seal,
                replies: replies as Replies,
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
          return;
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
    addReactToDm: async (whom, id, react) => {
      const delta: WritDelta = {
        'add-react': { react, ship: window.our },
      };
      await optimisticAction(whom, id, delta, set);
    },
    delReactToDm: async (whom, id) => {
      const delta: WritDelta = { 'del-react': window.our };
      await optimisticAction(whom, id, delta, set);
    },
    initializeMultiDm: async (id) => {
      await makeWritsStore(
        id,
        get,
        set,
        `/club/${id}/writs`,
        `/club/${id}/writs`
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
          path: `/clubs`,
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
        `/chat/${whom}/writs`
      ).initialize();
    },
    initializeDm: async (ship: string) => {
      await makeWritsStore(
        ship,
        get,
        set,
        `/dm/${ship}/writs`,
        `/dm/${ship}`
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

export function useMessagesForChat(whom: string, near?: string) {
  const window = useWritWindow(whom, near);
  const writs = useChatState(useCallback((s) => s.pacts[whom]?.writs, [whom]));

  return useMemo(() => {
    return window && writs
      ? writs.getRange(window.oldest, window.newest, true)
      : [];
  }, [writs, window]);
}

export function useHasMessages(whom: string) {
  const messages = useMessagesForChat(whom);
  return messages.length > 0;
}

/**
 * @param replying: if set, we're replying to a message
 * @param whom (optional) if provided, overrides the default behavior of using the current channel flag
 * @returns bigInt.BigInteger[] of the ids of the messages for the flag / whom
 */
export function useChatKeys({ whom }: { replying: boolean; whom: string }) {
  const messages = useMessagesForChat(whom ?? '');
  return useMemo(() => messages.map(([k]) => k), [messages]);
}

export function useTrackedMessageStatus(id: string) {
  return useChatState(
    useCallback(
      (s) => s.trackedMessages.find((m) => m.id === id)?.status || 'delivered',
      [id]
    )
  );
}

const emptyUnreads: DMUnreads = {};
const dmUnreadsKey = ['dm', 'unreads'];
export function useDmUnreads() {
  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({
          queryKey: dmUnreadsKey,
          refetchType: 'none',
        });
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const eventHandler = (event: DMUnreadUpdate) => {
    invalidate.current();
    const { unread } = event;

    if (unread !== null) {
      queryClient.setQueryData(dmUnreadsKey, (d: DMUnreads | undefined) => {
        if (d === undefined) {
          return undefined;
        }
        const newUnreads = { ...d };
        newUnreads[event.whom] = unread;

        useChatStore.getState().update(newUnreads);
        return newUnreads;
      });
    }
  };

  const { data, ...query } = useReactQuerySubscription<
    DMUnreads,
    DMUnreadUpdate
  >({
    queryKey: dmUnreadsKey,
    app: 'chat',
    path: '/unreads',
    scry: '/unreads',
    onEvent: eventHandler,
  });

  return {
    data: data || emptyUnreads,
    ...query,
  };
}

export function useDmUnread(whom: string) {
  const unreads = useDmUnreads();
  return unreads.data[whom];
}

export function useChatLoading(whom: string) {
  const unread = useDmUnread(whom);

  return useChatState(
    useCallback((s) => !s.pacts[whom] && !!unread, [whom, unread])
  );
}

export function useHasUnreadMessages() {
  const chats = useChatStore((s) => s.chats);
  const { dms, clubs } = useChatState((s) => ({
    dms: s.dms,
    clubs: s.multiDms,
  }));

  return dms.concat(Object.keys(clubs)).some((k) => {
    const chat = chats[k];
    if (!chat) {
      return false;
    }

    const { unread } = chat;
    return Boolean(unread && !unread.seen);
  });
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
    () => writId !== '' && writId !== '0' && !disabled,
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
    const replies = (writ.seal.replies || {}) as Replies;

    const diff: ReplyTuple[] = Object.entries(replies).map(([k, v]) => [
      bigInt(udToDec(k)),
      v as Reply,
    ]);

    const writWithReplies = {
      ...writ,
      seal: {
        ...writ.seal,
        replies: diff,
      },
    };

    return {
      writ: writWithReplies,
      ...rest,
    };
  }, [data, rest]);
}

export function useDeleteDMReplyMutation() {
  const mutationFn = async (variables: {
    whom: string;
    writId: string;
    replyId: string;
  }) => {
    const delta: WritDelta = {
      reply: {
        id: variables.replyId,
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

    await api.poke<ClubAction | DmAction | ChannelsAction>(action);
  };

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      queryClient.setQueryData(
        ['dms', variables.whom, variables.writId],
        (writ: WritInCache | undefined) => {
          if (!writ) {
            return writ;
          }

          const prevReplies = writ.seal.replies || {};
          const replies: Replies = {};

          Object.entries(prevReplies).forEach(([k, v]) => {
            replies[k] = v;
          });

          const reply = Object.values(replies).find(
            (q) => q.seal.id === variables.replyId
          );

          if (!reply) {
            return writ;
          }

          let time = '';

          Object.entries(replies).forEach(([k, v]) => {
            if (v.seal.id === variables.replyId) {
              time = k;
            }
          });

          delete replies[time];

          return {
            ...writ,
            seal: {
              ...writ.seal,
              replies: replies as Replies,
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

export function useAddDMReplyReactMutation() {
  const mutationFn = async (variables: {
    whom: string;
    writId: string;
    replyId: string;
    react: string;
  }) => {
    const delta: WritDelta = {
      reply: {
        id: variables.replyId,
        meta: null,
        delta: {
          'add-react': { react: variables.react, ship: window.our },
        },
      },
    };

    const action: Poke<DmAction | ClubAction> = whomIsDm(variables.whom)
      ? dmAction(variables.whom, delta as WritDelta, variables.writId)
      : multiDmAction(variables.whom, {
          writ: { id: variables.writId, delta: delta as WritDelta },
        });

    await api.poke<ClubAction | DmAction | ChannelsAction>(action);
  };

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      queryClient.setQueryData(
        ['dms', variables.whom, variables.writId],
        (writ: WritInCache | undefined) => {
          if (!writ) {
            return writ;
          }

          const prevReplies = writ.seal.replies || {};
          const replies: Replies = {};

          Object.entries(prevReplies).forEach(([k, v]) => {
            replies[k] = v;
          });

          const reply = Object.values(replies).find(
            (q) => q.seal.id === variables.replyId
          );

          if (!reply) {
            return writ;
          }

          let time = '';

          Object.entries(replies).forEach(([k, v]) => {
            if (v.seal.id === variables.replyId) {
              time = k;
            }
          });

          const newReply: Reply = {
            ...reply,
            seal: {
              ...reply.seal,
              reacts: {
                ...reply.seal.reacts,
                [window.our]: variables.react,
              },
            },
          };

          replies[time] = newReply;

          return {
            ...writ,
            seal: {
              ...writ.seal,
              replies: replies as Replies,
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

export function useDeleteDMReplyReactMutation() {
  const mutationFn = async (variables: {
    whom: string;
    writId: string;
    replyId: string;
  }) => {
    const delta: WritDelta = {
      reply: {
        id: variables.replyId,
        meta: null,
        delta: {
          'del-react': window.our,
        },
      },
    };

    const action: Poke<DmAction | ClubAction> = whomIsDm(variables.whom)
      ? dmAction(variables.whom, delta as WritDelta, variables.writId)
      : multiDmAction(variables.whom, {
          writ: { id: variables.writId, delta: delta as WritDelta },
        });

    await api.poke<ClubAction | DmAction | ChannelsAction>(action);
  };

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      queryClient.setQueryData(
        ['dms', variables.whom, variables.writId],
        (writ: WritInCache | undefined) => {
          if (!writ) {
            return writ;
          }

          const prevReplies = writ.seal.replies || {};
          const replies: Replies = {};

          Object.entries(prevReplies).forEach(([k, v]) => {
            replies[k] = v;
          });

          const reply = Object.values(replies).find(
            (q) => q.seal.id === variables.replyId
          );

          if (!reply) {
            return writ;
          }

          let time = '';

          Object.entries(replies).forEach(([k, v]) => {
            if (v.seal.id === variables.replyId) {
              time = k;
            }
          });

          const currentReacts = reply.seal.reacts;

          delete currentReacts[window.our];

          const newReply: Reply = {
            ...reply,
            seal: {
              ...reply.seal,
              reacts: {
                ...currentReacts,
              },
            },
          };

          replies[time] = newReply;

          return {
            ...writ,
            seal: {
              ...writ.seal,
              replies: replies as Replies,
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
  const { data: unreads } = useDmUnreads();
  const unread = unreads[whom];
  return Boolean(unread?.count > 0 && unread['unread-id']);
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
  const unread = useDmUnread(id);
  return useChatState(
    useCallback(
      (s) => {
        const chat = s.multiDms[id];
        const isPending = chat && chat.hive.includes(window.our);
        const inTeam = chat && chat.team.includes(window.our);

        if (isPending) {
          return true;
        }

        return !unread && !inTeam;
      },
      [id, unread]
    )
  );
}

const selDmArchive = (s: ChatState) => s.dmArchive;
export function useDmArchive() {
  return useChatState(selDmArchive);
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
  writ: Post;
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
  const unread = useDmUnread(whom);
  if (!unread) {
    return null;
  }
  const { 'unread-id': lastRead } = unread;
  if (!lastRead) {
    return null;
  }
  // lastRead is formatted like: ~zod/123.456.789...
  const lastReadBN = bigInt(lastRead.split('/')[1].replaceAll('.', ''));
  const firstUnread = keys.find((key) => key.gt(lastReadBN));
  return firstUnread ?? null;
}

export function useLatestMessage(chFlag: string): [BigInteger, Writ | null] {
  const messages = useMessagesForChat(chFlag);
  const messagesTree = newWritMap(messages);
  const max = messagesTree.maxKey();
  return messagesTree.size > 0 && max
    ? [max, messagesTree.get(max) || null]
    : [bigInt(), null];
}

export function useBlockedShips() {
  const { data, ...rest } = useReactQueryScry<BlockedShips>({
    queryKey: ['chat', 'blocked'],
    app: 'chat',
    path: '/blocked',
  });

  if (!data) {
    return {
      blocked: [],
      ...rest,
    };
  }

  return {
    blocked: data,
    ...rest,
  };
}

export function useIsShipBlocked(ship: string) {
  const { blocked } = useBlockedShips();

  return blocked.includes(ship);
}

export function useBlockedByShips() {
  const { data, ...rest } = useReactQueryScry<BlockedByShips>({
    queryKey: ['chat', 'blocked-by'],
    app: 'chat',
    path: '/blocked-by',
  });

  if (!data) {
    return {
      blockedBy: [],
      ...rest,
    };
  }

  return {
    blockedBy: data,
    ...rest,
  };
}

export function useShipHasBlockedUs(ship: string) {
  const { blockedBy } = useBlockedByShips();

  return blockedBy.includes(ship);
}

export function useBlockShipMutation() {
  const mutationFn = (variables: { ship: string }) =>
    api.poke({
      app: 'chat',
      mark: 'chat-block-ship',
      json: variables,
    });

  return useMutation(mutationFn, {
    onMutate: ({ ship }) => {
      queryClient.setQueryData<BlockedShips>(['chat', 'blocked'], (old) => [
        ...(old ?? []),
        ship,
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['chat', 'blocked']);
    },
  });
}

export function useUnblockShipMutation() {
  const mutationFn = (variables: { ship: string }) =>
    api.poke({
      app: 'chat',
      mark: 'chat-unblock-ship',
      json: variables,
    });

  return useMutation(mutationFn, {
    onMutate: ({ ship }) => {
      queryClient.setQueryData<BlockedShips>(['chat', 'blocked'], (old) =>
        (old ?? []).filter((s) => s !== ship)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['chat', 'blocked']);
    },
  });
}

export function useHiddenMessages() {
  return useReactQueryScry<HiddenMessages>({
    queryKey: ['chat', 'hidden'],
    app: 'chat',
    path: '/hidden-messages',
    options: {
      placeholderData: [],
    },
  });
}

export function useToggleMessageMutation() {
  const mutationFn = (variables: { toggle: ToggleMessage }) =>
    api.poke({
      app: 'chat',
      mark: 'chat-toggle-message',
      json: variables.toggle,
    });

  return useMutation(mutationFn, {
    onMutate: ({ toggle }) => {
      queryClient.setQueryData<HiddenMessages>(
        ['chat', 'hidden'],
        resolveHiddenMessages(toggle)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['chat', 'hidden']);
    },
  });
}

export function useMessageToggler(id: string) {
  const { mutate } = useToggleMessageMutation();
  const { data: hidden } = useHiddenMessages();
  const isHidden = useMemo(
    () => (hidden || []).some((h) => h === id),
    [hidden, id]
  );
  const show = useCallback(
    () => mutate({ toggle: { show: id } }),
    [mutate, id]
  );
  const hide = useCallback(
    () => mutate({ toggle: { hide: id } }),
    [mutate, id]
  );

  return {
    show,
    hide,
    isHidden,
  };
}

(window as any).chat = useChatState.getState;
