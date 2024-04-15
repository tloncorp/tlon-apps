import { QueryKey, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import {
  CacheId,
  ChannelsAction,
  Replies,
  Reply,
  ReplyTuple,
} from '@tloncorp/shared/dist/urbit/channel';
import {
  BlockedByShips,
  BlockedShips,
  Club,
  ClubAction,
  ClubDelta,
  Clubs,
  DMInit,
  DMUnreadUpdate,
  DMUnreads,
  DmAction,
  HiddenMessages,
  Hive,
  PagedWrits,
  ReplyDelta,
  ToggleMessage,
  Writ,
  WritDelta,
  WritDeltaAdd,
  WritDiff,
  WritInCache,
  WritResponse,
  WritResponseDelta,
  WritSeal,
  WritTuple,
  Writs,
  newWritTupleArray,
} from '@tloncorp/shared/dist/urbit/dms';
import { GroupMeta } from '@tloncorp/shared/dist/urbit/groups';
import { decToUd, udToDec } from '@urbit/api';
import { formatUd, unixToDa } from '@urbit/aura';
import { Poke } from '@urbit/http-api';
import bigInt, { BigInteger } from 'big-integer';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import create from 'zustand';

import api from '@/api';
import { ChatStore, useChatInfo, useChatStore } from '@/chat/useChatStore';
import {
  LARGE_MESSAGE_FETCH_PAGE_SIZE,
  STANDARD_MESSAGE_FETCH_PAGE_SIZE,
} from '@/constants';
import { isNativeApp } from '@/logic/native';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { whomIsDm } from '@/logic/utils';
import queryClient from '@/queryClient';

// eslint-disable-next-line import/no-cycle
import { PostStatus, TrackedPost } from '../channel/channel';
import ChatKeys from './keys';
import emptyMultiDm, {
  appendWritToLastPage,
  buildCachedWrit,
  buildWritPage,
  removePendingFromCache,
  removeUnreadFromCache,
} from './utils';

const CHAT_PAGE_SIZE = isNativeApp()
  ? STANDARD_MESSAGE_FETCH_PAGE_SIZE
  : LARGE_MESSAGE_FETCH_PAGE_SIZE;

export interface State {
  trackedWrits: TrackedPost[];
  addTracked: (id: CacheId) => void;
  updateStatus: (id: CacheId, status: PostStatus) => void;
  getStatus: (id: CacheId) => PostStatus;
  hasSomeUndelivered: () => boolean;
  [key: string]: unknown;
}

export const useWritsStore = create<State>((set, get) => ({
  trackedWrits: [],
  addTracked: (id) => {
    set((state) => ({
      trackedWrits: [{ status: 'pending', cacheId: id }, ...state.trackedWrits],
    }));
  },
  updateStatus: (id, s) => {
    set((state) => ({
      trackedWrits: state.trackedWrits.map(({ cacheId, status }) => {
        if (_.isEqual(cacheId, id)) {
          return { status: s, cacheId };
        }

        return { status, cacheId };
      }),
    }));
  },
  getStatus: (id) => {
    const { trackedWrits } = get();

    const post = trackedWrits.find(
      ({ cacheId }) => cacheId.author === id.author && cacheId.sent === id.sent
    );

    return post?.status ?? 'delivered';
  },
  hasSomeUndelivered: () => {
    return get().trackedWrits.some(({ status }) => status !== 'delivered');
  },
}));

function dmAction(ship: string, delta: WritDelta, id: string): Poke<DmAction> {
  return {
    app: 'chat',
    mark: 'chat-dm-action',
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
    mark: 'chat-club-action-0',
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

export function initializeChat({ dms, clubs, invited, unreads }: DMInit) {
  queryClient.setQueryData(['dms', 'dms'], () => dms || []);
  queryClient.setQueryData(['dms', 'multi'], () => clubs || {});
  queryClient.setQueryData(ChatKeys.pending(), () => invited || []);
  queryClient.setQueryData(ChatKeys.unreads(), () => unreads || {});

  useChatStore.getState().update(unreads);
}

interface PageParam {
  time: BigInteger;
  direction: string;
}

interface InfiniteDMsData {
  pages: PagedWrits[];
  pageParams: PageParam[];
}

interface UpdateWritsInCacheParams {
  whom: string;
  updater: (
    queryData: InfiniteDMsData | undefined
  ) => InfiniteDMsData | undefined;
}
async function updateWritsInCache({ whom, updater }: UpdateWritsInCacheParams) {
  const queryKey = ['dms', whom, 'infinite'];
  await queryClient.cancelQueries(queryKey);
  queryClient.setQueriesData(queryKey, updater);
}

interface UpdateWritInCacheParams {
  whom: string;
  writId: string;
  updater: (writ: Writ | undefined) => Writ | undefined;
}
async function updateWritInCache({
  whom,
  writId,
  updater,
}: UpdateWritInCacheParams) {
  const queryKey = ['dms', whom, writId];
  await queryClient.cancelQueries(queryKey);
  queryClient.setQueryData(queryKey, updater);
}

function infiniteDMsUpdater(queryKey: QueryKey, data: WritDiff | WritResponse) {
  const whom = queryKey[1] as string;
  let id: string | undefined;
  let delta: WritDelta | WritResponseDelta;
  if ('response' in data) {
    id = data.id;
    delta = data.response;
  } else {
    id = data.id;
    delta = data.delta;
  }

  if (!delta || !id) {
    return;
  }

  if ('add' in delta) {
    const time = delta.add.time
      ? bigInt(delta.add.time)
      : unixToDa(delta.add.memo.sent);

    const seal: WritSeal = {
      id,
      time: time.toString(),
      reacts: {},
      replies: null,
      meta: {
        replyCount: 0,
        lastRepliers: [],
        lastReply: null,
      },
    };

    const writ: Writ = {
      seal,
      essay: {
        ...delta.add.memo,
        'kind-data': {
          chat: 'kind' in delta.add ? delta.add.kind : null,
        },
      },
    };

    queryClient.setQueryData<{
      pages: PagedWrits[];
      pageParams: PageParam[];
    }>(queryKey, (queryData) => {
      if (queryData === undefined) {
        return {
          pages: [
            {
              writs: {
                [time.toString()]: writ,
              },
              newer: null,
              older: null,
              total: 1,
            },
          ],
          pageParams: [],
        };
      }

      const lastPage = _.last(queryData.pages);
      if (lastPage === undefined) {
        return undefined;
      }

      const newWrits = {
        ...lastPage.writs,
        [time.toString()]: writ,
      };

      const newLastPage = {
        ...lastPage,
        writs: newWrits,
      };

      const cachedWrit =
        lastPage.writs[decToUd(unixToDa(writ.essay.sent).toString())];

      if (
        cachedWrit &&
        time.toString() !== unixToDa(writ.essay.sent).toString()
      ) {
        // remove cached post if it exists
        delete newLastPage.writs[decToUd(unixToDa(writ.essay.sent).toString())];

        // set delivered now that we have the real writ
        useWritsStore
          .getState()
          .updateStatus(
            { author: writ.essay.author, sent: writ.essay.sent },
            'delivered'
          );
      }

      return {
        pages: [...queryData.pages.slice(0, -1), newLastPage],
        pageParams: queryData.pageParams,
      };
    });
  } else if ('del' in delta) {
    queryClient.setQueryData<{
      pages: PagedWrits[];
      pageParams: PageParam[];
    }>(queryKey, (queryData) => {
      if (queryData === undefined) {
        return undefined;
      }

      const newPages = queryData.pages.map((page) => {
        const newWrits = { ...page.writs };
        Object.entries(page.writs).forEach(([k, w]) => {
          if (w.seal.id === id) {
            delete newWrits[k];
          }
        });

        return {
          ...page,
          writs: newWrits,
        };
      });

      return {
        pages: newPages,
        pageParams: queryData.pageParams,
      };
    });
  } else if ('add-react' in delta) {
    const { ship, react } = delta['add-react'];
    queryClient.setQueryData<InfiniteDMsData>(queryKey, (queryData) => {
      if (queryData === undefined) {
        return undefined;
      }

      const newPages = queryData.pages.map((page) => {
        let writId: string | undefined;
        const inPage =
          Object.entries(page.writs).some(([k, w]) => {
            if (w.seal.id === id) {
              writId = k;
              return true;
            }
            return false;
          }) ?? false;
        if (inPage) {
          const writ = page.writs[writId!];
          if (!writ) {
            return page;
          }

          const newPage = {
            ...page,
            writs: {
              ...page.writs,
              [writId!]: {
                ...writ,
                seal: {
                  ...writ.seal,
                  reacts: {
                    ...writ.seal.reacts,
                    [ship]: react,
                  },
                },
              },
            },
          };
          return newPage;
        }
        return page;
      });

      return {
        pages: newPages,
        pageParams: queryData.pageParams,
      };
    });
  } else if ('del-react' in delta) {
    const ship = delta['del-react'];
    queryClient.setQueryData<InfiniteDMsData>(queryKey, (queryData) => {
      if (queryData === undefined) {
        return undefined;
      }

      const newPages = queryData.pages.map((page) => {
        let writId: string | undefined;
        const inPage =
          Object.entries(page.writs).some(([k, w]) => {
            if (w.seal.id === id) {
              writId = k;
              return true;
            }
            return false;
          }) ?? false;
        if (inPage) {
          const writ = page.writs[writId!];
          if (!writ) {
            return page;
          }

          delete writ.seal.reacts[ship];

          const newPage = {
            ...page,
            writs: {
              ...page.writs,
              [writId!]: {
                ...writ,
                seal: {
                  ...writ.seal,
                  reacts: {
                    ...writ.seal.reacts,
                  },
                },
              },
            },
          };
          return newPage;
        }
        return page;
      });

      return {
        pages: newPages,
        pageParams: queryData.pageParams,
      };
    });
  } else if ('reply' in delta) {
    const replyParentQueryKey = ['dms', whom, id];
    const { reply } = delta;
    if ('add' in reply.delta) {
      queryClient.setQueriesData<InfiniteDMsData>(queryKey, (queryData) => {
        if (queryData === undefined) {
          return undefined;
        }

        const allWritsInPages = queryData.pages.flatMap((page) =>
          Object.entries(page.writs)
        );

        const writFind = allWritsInPages.find(([k, w]) => w.seal.id === id);

        if (writFind) {
          const replyId = writFind[0];
          const replyingWrit = writFind[1];

          if (replyingWrit === undefined || replyingWrit === null) {
            return queryData;
          }

          const replyAuthor =
            'add' in reply.delta ? reply.delta.add.memo.author : ''; // should never happen

          const updatedWrit = {
            ...replyingWrit,
            seal: {
              ...replyingWrit.seal,
              meta: {
                ...replyingWrit.seal.meta,
                replyCount: replyingWrit.seal.meta.replyCount + 1,
                repliers: [...replyingWrit.seal.meta.lastRepliers, replyAuthor],
              },
            },
          };

          const pageInCache = queryData.pages.find((page) =>
            Object.keys(page.writs).some((k) => k === replyId)
          );

          const pageInCacheIdx = queryData.pages.findIndex((page) =>
            Object.keys(page.writs).some((k) => k === replyId)
          );

          if (pageInCache === undefined) {
            return queryData;
          }

          return {
            pages: [
              ...queryData.pages.slice(0, pageInCacheIdx),
              {
                ...pageInCache,
                writs: {
                  ...pageInCache.writs,
                  [replyId]: updatedWrit,
                },
              },
              ...queryData.pages.slice(pageInCacheIdx + 1),
            ],
            pageParams: queryData.pageParams,
          };
        }

        return {
          pages: queryData.pages,
          pageParams: queryData.pageParams,
        };
      });

      queryClient.setQueryData(
        replyParentQueryKey,
        (queryData: WritInCache | undefined) => {
          if (queryData === undefined) {
            return undefined;
          }

          if (!('add' in reply.delta)) {
            return queryData;
          }
          const { memo } = reply.delta.add;

          const prevWrit = queryData as WritInCache;
          const prevReplies = prevWrit.seal.replies;

          const hasInCache = Object.entries(prevReplies).find(([k, r]) => {
            return r.memo.sent === memo.sent && r.memo.author === memo.author;
          });

          if (hasInCache) {
            return queryData;
          }

          const replyId = unixToDa(memo.sent).toString();
          const newReply: Reply = {
            seal: {
              id: replyId,
              'parent-id': id!,
              reacts: {},
            },
            memo,
          };

          const newReplies = {
            ...prevReplies,
            [replyId]: newReply,
          };

          return {
            ...prevWrit,
            seal: {
              ...prevWrit.seal,
              replies: newReplies,
            },
          };
        }
      );
    }
  }
}

export function useMultiDmsQuery() {
  return useReactQueryScry<Clubs>({
    queryKey: ['dms', 'multi'],
    app: 'chat',
    path: '/clubs',
  });
}

export function useMultiDmsSubscription() {
  return useReactQuerySubscription<Clubs, ClubAction>({
    queryKey: ['dms', 'multi'],
    app: 'chat',
    scry: '/clubs',
    path: '/clubs',
  });
}

export function useMultiDms(): Clubs {
  const { data } = useMultiDmsSubscription();

  if (!data) {
    return {};
  }

  return data;
}

export function useMultiDm(id: string): Club {
  const multiDms = useMultiDms();
  const dm = multiDms[id];

  if (!dm) {
    return emptyMultiDm();
  }

  return dm;
}

export function usePendingMultiDms() {
  const multiDms = useMultiDms();

  return Object.entries(multiDms)
    .filter(([, value]) => value.hive.includes(window.our))
    .map(([key]) => key);
}

export function useDmsQuery() {
  return useReactQueryScry<string[]>({
    queryKey: ['dms', 'dms'],
    app: 'chat',
    path: '/dm',
  });
}

export function useDms(): string[] {
  const { data } = useDmsQuery();

  if (!data) {
    return [];
  }

  return data;
}

export function usePendingDms() {
  const { data, ...rest } = useReactQuerySubscription<string[]>({
    queryKey: ChatKeys.pending(),
    app: 'chat',
    path: '/dm/invited',
    scry: '/dm/invited',
  });

  if (!data) {
    return {
      ...rest,
      pending: [],
    };
  }

  return {
    ...rest,
    pending: data,
  };
}

export function useDmIsPending(ship: string) {
  const { pending } = usePendingDms();
  return pending.includes(ship);
}

export function useMarkDmReadMutation() {
  const mutationFn = async (variables: { whom: string }) => {
    const { whom } = variables;
    await api.poke({
      app: 'chat',
      mark: 'chat-remark-action',
      json: {
        whom,
        diff: { read: null },
      },
    });
  };

  return useMutation({
    mutationFn,
  });
}

export function useDmUnreads() {
  const dmUnreadsKey = ChatKeys.unreads();
  const { mutate: markDmRead } = useMarkDmReadMutation();
  const { pending } = usePendingDms();
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

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
    const { whom, unread } = event;

    // we don't get an update on the pending subscription when rsvps are accepted
    // but we do get an unread notification, so we use it here for invalidation
    if (pendingRef.current.includes(whom)) {
      queryClient.invalidateQueries(ChatKeys.pending());
    }

    if (unread !== null) {
      useChatStore
        .getState()
        .handleUnread(whom, unread, () => markDmRead({ whom }));
    }

    queryClient.setQueryData(dmUnreadsKey, (d: DMUnreads | undefined) => {
      if (d === undefined) {
        return undefined;
      }

      const newUnreads = { ...d };
      newUnreads[event.whom] = unread;

      return newUnreads;
    });
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
    options: {
      retryOnMount: true,
      refetchOnMount: true,
    },
  });

  return {
    data: data || {},
    ...query,
  };
}

export function useDmUnread(whom: string) {
  const unreads = useDmUnreads();
  return unreads.data[whom];
}

export function useArchiveDm() {
  const mutationFn = async ({ whom }: { whom: string }) => {
    await api.poke({
      app: 'chat',
      mark: 'chat-dm-archive',
      json: whom,
    });
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom } = variables;
      queryClient.setQueryData(
        ChatKeys.unreads(),
        (unreads: DMUnreads | undefined) => {
          if (!unreads) {
            return unreads;
          }

          const newUnreads = { ...unreads };

          delete newUnreads[whom];

          return newUnreads;
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(ChatKeys.unreads());
    },
  });
}

export function useUnarchiveDm() {
  const mutationFn = async ({ ship }: { ship: string }) => {
    await api.poke({
      app: 'chat',
      mark: 'chat-dm-unarchive',
      json: ship,
    });
  };

  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries(ChatKeys.unreads());
    },
  });
}

export function useDmRsvpMutation() {
  const mutationFn = async ({
    ship,
    accept,
  }: {
    ship: string;
    accept: boolean;
  }) => {
    await api.poke({
      app: 'chat',
      mark: 'chat-dm-rsvp',
      json: {
        ship,
        ok: accept,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { ship, accept } = variables;

      // optimistic updates
      if (accept) {
        removePendingFromCache(queryClient, ship);
      } else {
        removeUnreadFromCache(queryClient, ship);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries(ChatKeys.unreads());
      queryClient.invalidateQueries(ChatKeys.pending());
      queryClient.invalidateQueries(['dms', 'dms']);
      queryClient.invalidateQueries(['dms', variables.ship]);
    },
  });
}

export function useCreateMultiDm() {
  const mutationFn = async ({ id, hive }: { id: string; hive: string[] }) => {
    await api.poke({
      app: 'chat',
      mark: 'chat-club-create',
      json: {
        id,
        hive,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { id, hive } = variables;
      queryClient.setQueryData<Clubs>(
        ['dms', 'multi'],
        (prev: Clubs | undefined) => {
          if (!prev) {
            return prev;
          }

          const newMultiDms = { ...prev };

          newMultiDms[id] = {
            hive,
            team: [window.our],
            meta: {
              title: '',
              description: '',
              image: '',
              cover: '',
            },
          };

          return newMultiDms;
        }
      );
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries(['dms', 'multi']);
      queryClient.invalidateQueries(['dms', variables.id]);
    },
  });
}

export function useEditMultiDm() {
  const mutationFn = async ({ id, meta }: { id: string; meta: GroupMeta }) => {
    const action = multiDmAction(id, { meta });
    await api.poke(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { id, meta } = variables;
      queryClient.setQueryData<Clubs>(
        ['dms', 'multi'],
        (prev: Clubs | undefined) => {
          if (!prev) {
            return prev;
          }

          const newMultiDms = { ...prev };

          newMultiDms[id] = {
            ...newMultiDms[id],
            meta,
          };

          return newMultiDms;
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'multi']);
    },
  });
}

export function useInviteToMultiDm() {
  const mutationFn = async ({
    id,
    hive,
  }: {
    id: string;
    hive: Omit<Hive, 'add'>;
  }) => {
    const action = multiDmAction(id, { hive: { ...hive, add: true } });
    await api.poke(action);
  };

  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'multi']);
    },
  });
}

export function useRemoveFromMultiDm() {
  const mutationFn = async ({
    id,
    hive,
  }: {
    id: string;
    hive: Omit<Hive, 'add'>;
  }) => {
    const action = multiDmAction(id, { hive: { ...hive, add: false } });
    await api.poke(action);
  };

  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'multi']);
    },
  });
}

export function useMutliDmRsvpMutation() {
  const mutationFn = async ({
    id,
    accept,
  }: {
    id: string;
    accept: boolean;
  }) => {
    const action = multiDmAction(id, {
      team: { ship: window.our, ok: accept },
    });
    await api.poke(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { id, accept } = variables;

      // optimistic updates
      if (accept) {
        removePendingFromCache(queryClient, id);
      } else {
        removeUnreadFromCache(queryClient, id);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries(ChatKeys.unreads());
      queryClient.invalidateQueries(ChatKeys.pending());
      queryClient.invalidateQueries(['dms', 'multi']);
      queryClient.invalidateQueries(['dms', variables.id]);
    },
  });
}

export interface SendReplyVariables {
  whom: string;
  message: {
    id: string;
    delta: WritDeltaAdd | ReplyDelta;
    cacheId: {
      author: string;
      sent: number;
    };
  };
  parentId: string;
}
export function useSendReplyMutation() {
  const mutationFn = async ({
    whom,
    message,
    parentId,
  }: SendReplyVariables) => {
    const { action } = getActionAndEvent(whom, parentId, message.delta);

    await api.poke<ClubAction | DmAction>(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom, message, parentId } = variables;
      const infiniteQueryKey = ['dms', whom, 'infinite'];

      useWritsStore.getState().addTracked(message.cacheId);

      infiniteDMsUpdater(infiniteQueryKey, {
        id: parentId,
        delta: message.delta,
      });
    },
    onSuccess: async (_data, variables) => {
      const { cacheId } = variables.message;

      const status = useWritsStore.getState().getStatus(cacheId);
      if (status === 'pending') {
        useWritsStore.getState().updateStatus(cacheId, 'sent');
      }
    },
    onError: async (_error, variables) => {
      const { cacheId } = variables.message;
      useWritsStore.setState((state) => ({
        ...state,
        trackedWrits: state.trackedWrits.filter((p) => p.cacheId !== cacheId),
      }));
    },
    onSettled: (_data, _error, variables) => {
      const { whom, parentId } = variables;
      const infiniteQueryKey = ['dms', whom, 'infinite'];
      const parentWritQueryKey = ['dms', whom, parentId];

      queryClient.invalidateQueries(parentWritQueryKey, {
        refetchType: 'none',
      });
      queryClient.invalidateQueries(infiniteQueryKey, { refetchType: 'none' });
    },
  });
}

export interface SendMessageVariables {
  whom: string;
  delta: WritDeltaAdd;
}
export function useSendMessage() {
  const mutationFn = async ({ whom, delta }: SendMessageVariables) => {
    const { action } = getActionAndEvent(
      whom,
      `${delta.add.memo.author}/${formatUd(unixToDa(delta.add.memo.sent))}`,
      delta
    );
    await api.poke<ClubAction | DmAction>(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom, delta } = variables;
      const { sent, author } = delta.add.memo;
      const trackingId = { author, sent };

      useWritsStore.getState().addTracked(trackingId);

      // handle optimistic update
      const cachedWrit = buildCachedWrit(sent, delta as WritDeltaAdd);
      const updater = (queryData: InfiniteDMsData | undefined) => {
        if (queryData === undefined || queryData.pages.length === 0) {
          const initialPage = buildWritPage(cachedWrit);
          return {
            pages: [initialPage],
            pageParams: [],
          };
        }
        const newPages = appendWritToLastPage(queryData.pages, cachedWrit);
        return {
          pages: newPages,
          pageParams: queryData.pageParams,
        };
      };
      updateWritsInCache({ whom, updater });
    },
    onSuccess: async (_data, variables) => {
      const { author, sent } = variables.delta.add.memo;
      const trackingId = { author, sent };

      const status = useWritsStore.getState().getStatus(trackingId);
      if (status === 'pending') {
        useWritsStore.getState().updateStatus(trackingId, 'sent');
      }
    },
    onError: async (_error, variables) => {
      console.error(_error);
      const { author, sent } = variables.delta.add.memo;
      const trackingId = { author, sent };

      useWritsStore.setState((state) => ({
        ...state,
        trackedWrits: state.trackedWrits.filter(
          (p) => p.cacheId !== trackingId
        ),
      }));
    },
  });
}

export function useDeleteDmMutation() {
  const mutationFn = async ({ whom, id }: { whom: string; id: string }) => {
    const delta = { del: null };
    if (whomIsDm(whom)) {
      await api.trackedPoke<DmAction, WritResponse>(
        dmAction(whom, delta, id),
        { app: 'chat', path: `/dm/${whom}` },
        (event) => event.id === id && 'del' in event.response
      );
    } else {
      await api.trackedPoke<ClubAction, WritResponse>(
        multiDmAction(whom, { writ: { id, delta } }),
        { app: 'chat', path: `/club/${whom}` },
        (event) => event.id === id && 'del' in event.response
      );
    }
  };

  return useMutation({
    mutationFn,
    onSettled: (_data, _error, variables) => {
      const { whom } = variables;
      queryClient.invalidateQueries(['dms', whom, 'infinite']);
    },
  });
}

export function useAddDmReactMutation() {
  const mutationFn = async (variables: {
    whom: string;
    id: string;
    react: string;
  }) => {
    const { whom, id, react } = variables;
    const delta: WritDelta = {
      'add-react': { react, ship: window.our },
    };

    const { action } = getActionAndEvent(whom, id, delta);
    await api.poke<ClubAction | DmAction>(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom, id, react } = variables;
      const delta: WritDelta = {
        'add-react': { react, ship: window.our },
      };
      const queryKey = ['dms', whom, 'infinite'];
      infiniteDMsUpdater(queryKey, { id, delta });
    },
    onSettled: (_data, _error, variables) => {
      const { whom } = variables;
      queryClient.invalidateQueries(['dms', whom, 'infinite']);
    },
  });
}

export function useDelDmReactMutation() {
  const mutationFn = async (variables: { whom: string; id: string }) => {
    const { whom, id } = variables;
    const delta: WritDelta = { 'del-react': window.our };
    const { action } = getActionAndEvent(whom, id, delta);
    await api.poke<ClubAction | DmAction>(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom, id } = variables;
      const delta: WritDelta = { 'del-react': window.our };
      const queryKey = ['dms', whom, 'infinite'];
      infiniteDMsUpdater(queryKey, { id, delta });
    },
    onSettled: (_data, _error, variables) => {
      const { whom } = variables;
      queryClient.invalidateQueries(['dms', whom, 'infinite']);
    },
  });
}

export function checkResponseForDeliveries(response: WritResponseDelta) {
  if ('add' in response) {
    const { memo } = response.add;

    useWritsStore
      .getState()
      .updateStatus({ author: memo.author, sent: memo.sent }, 'delivered');
  } else if ('reply' in response) {
    const { reply } = response;

    if ('add' in reply.delta) {
      const { memo } = reply.delta.add;

      useWritsStore.getState().updateStatus(
        {
          author: memo.author,
          sent: memo.sent,
        },
        'delivered'
      );
    }
  }
}

export function checkWritsForDeliveries(writs: Writs) {
  Object.entries(writs).forEach(([id, writ]) => {
    const trackingId = { author: writ.essay.author, sent: writ.essay.sent };
    if (useWritsStore.getState().getStatus(trackingId) !== 'delivered') {
      useWritsStore.getState().updateStatus(trackingId, 'delivered');
    }
  });
}

export const infiniteDMsQueryFn =
  (whom: string, type: 'dm' | 'club', initialTime?: string) =>
  async ({ pageParam }: { pageParam?: PageParam }) => {
    let path = '';

    if (pageParam) {
      const { time, direction } = pageParam;
      const ud = decToUd(time.toString());
      path = `/${type}/${whom}/writs/${direction}/${ud}/${CHAT_PAGE_SIZE}/light`;
    } else if (initialTime) {
      path = `/${type}/${whom}/writs/around/${decToUd(initialTime)}/${
        CHAT_PAGE_SIZE / 2
      }/light`;
    } else {
      path = `/${type}/${whom}/writs/newest/${CHAT_PAGE_SIZE}/light`;
    }

    const response = await api.scry<PagedWrits>({
      app: 'chat',
      path,
    });

    if (response.writs && useWritsStore.getState().hasSomeUndelivered()) {
      checkWritsForDeliveries(response.writs);
    }

    return {
      ...response,
    };
  };

export function useInfiniteDMs(whom: string, initialTime?: string) {
  const unread = useDmUnread(whom);
  const isDM = useMemo(() => whomIsDm(whom), [whom]);
  const type = useMemo(() => (isDM ? 'dm' : 'club'), [isDM]);
  const queryKey = useMemo(() => ['dms', whom, 'infinite'], [whom]);

  const invalidate = useRef(
    _.debounce(
      (key: string[]) => {
        queryClient.invalidateQueries({ queryKey: key });
      },
      300,
      {
        leading: true,
        trailing: true,
      }
    )
  );

  useEffect(() => {
    if (unread) {
      api.subscribe({
        app: 'chat',
        path: `/${type}/${whom}`,
        event: (data: WritResponse) => {
          const { response } = data;
          if (response && useWritsStore.getState().hasSomeUndelivered()) {
            checkResponseForDeliveries(response);
          }

          infiniteDMsUpdater(queryKey, data);

          invalidate.current(queryKey);
        },
      });
    }
  }, [whom, type, isDM, queryKey, unread, invalidate]);

  const { data, ...rest } = useInfiniteQuery<PagedWrits>({
    queryKey,
    queryFn: infiniteDMsQueryFn(whom, type, initialTime),
    getNextPageParam: (lastPage): PageParam | undefined => {
      const { older } = lastPage;

      if (!older) {
        return undefined;
      }

      return {
        time: bigInt(older),
        direction: 'older',
      };
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      const { newer } = firstPage;

      if (!newer) {
        return undefined;
      }

      return {
        time: bigInt(newer),
        direction: 'newer',
      };
    },
    refetchOnMount: true,
    retryOnMount: true,
    retry: false,
  });

  const writs = newWritTupleArray(data);

  return {
    data,
    writs,
    ...rest,
  };
}

export function useTrackedMessageStatus(cacheId: CacheId) {
  return useWritsStore(
    (s) =>
      s.trackedWrits.find(
        ({ cacheId: nId }) =>
          nId.author === cacheId.author && nId.sent === cacheId.sent
      )?.status || 'delivered'
  );
}

export function useHasUnreadMessages() {
  const chats = useChatStore((s) => s.chats);
  const dms = useDms();
  const clubs = useMultiDms();

  return dms.concat(Object.keys(clubs)).some((k) => {
    const chat = chats[k];
    if (!chat) {
      return false;
    }

    const { unread } = chat;
    return Boolean(unread && !unread.seen);
  });
}

export function useWrit(whom: string, writId: string, disabled = false) {
  const queryKey = useMemo(() => ['dms', whom, writId], [whom, writId]);

  const scryPath = useMemo(() => {
    const suffix = `/writs/writ/id/${writId}`;
    if (whomIsDm(whom)) {
      return `/dm/${whom}${suffix}`;
    }

    return `/club/${whom}${suffix}`;
  }, [writId, whom]);

  const subPath = useMemo(() => {
    if (whomIsDm(whom)) {
      return `/dm/${whom}/writs`;
    }

    return `/club/${whom}/writs`;
  }, [whom]);

  const enabled = useMemo(
    () => writId !== '' && writId !== '0' && !disabled,
    [writId, disabled]
  );
  const { data, ...rest } = useReactQuerySubscription<Writ>({
    queryKey,
    app: 'chat',
    scry: scryPath,
    path: subPath,
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

    if (whomIsDm(variables.whom)) {
      await api.trackedPoke<DmAction, WritResponse>(
        dmAction(variables.whom, delta, variables.writId),
        { app: 'chat', path: `/dm/${variables.whom}` },
        (event) =>
          event.id === variables.writId &&
          'reply' in event.response &&
          variables.replyId === event.response.reply.id &&
          'del' in event.response.reply.delta
      );
    } else {
      await api.trackedPoke<ClubAction, WritResponse>(
        multiDmAction(variables.whom, {
          writ: { id: variables.writId, delta },
        }),
        { app: 'chat', path: `/club/${variables.whom}` },
        (event) =>
          event.id === variables.writId &&
          'reply' in event.response &&
          variables.replyId === event.response.reply.id &&
          'del' in event.response.reply.delta
      );
    }
  };

  return useMutation(mutationFn, {
    onSuccess: (data, variables) => {
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
  const chatInfo = useChatInfo(whom);
  const unread = chatInfo?.unread;
  return Boolean(unread && !unread.seen);
}

const selChats = (s: ChatStore) => s.chats;
export function useCheckDmUnread() {
  const chats = useChatStore(selChats);

  return useCallback(
    (whom: string) => {
      const chatInfo = chats[whom];
      const unread = chatInfo?.unread;
      return Boolean(unread && !unread.seen);
    },
    [chats]
  );
}

export function useChatStoreDmUnreads(): string[] {
  const chats = useChatStore(selChats);

  return useMemo(
    () =>
      Object.entries(chats).reduce((acc, [k, v]) => {
        if (whomIsDm(k)) {
          const { unread } = v;
          if (unread && !unread.seen) {
            acc.push(k);
          }
        }

        return acc;
      }, [] as string[]),
    [chats]
  );
}

export function useMultiDmIsPending(id: string): boolean {
  const unread = useDmUnread(id);
  const chat = useMultiDm(id);

  const isPending = chat && chat.hive.includes(window.our);
  const inTeam = chat && chat.team.includes(window.our);

  if (isPending) {
    return true;
  }

  return !unread && !inTeam;
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
