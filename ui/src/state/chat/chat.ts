import _ from 'lodash';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce, { setAutoFreeze } from 'immer';
import create, { SetState } from 'zustand';
import { Poke } from '@urbit/http-api';
import { formatUd, unixToDa } from '@urbit/aura';
import { decToUd, udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  QueryKey,
  Updater,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import { GroupMeta, Groups } from '@/types/groups';
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
  PagedWrits,
  WritTuple,
  WritResponseDelta,
  WritSeal,
  DMWhom,
  WritDeltaAdd,
  ReplyDelta,
  Hive,
} from '@/types/dms';
import {
  Post,
  PostEssay,
  Reply,
  Replies,
  ChannelsAction,
  ReplyTuple,
  WritEssay,
} from '@/types/channel';
import api from '@/api';
import { whomIsDm, whomIsMultiDm, whomIsFlag, whomIsNest } from '@/logic/utils';
import { useChatStore } from '@/chat/useChatStore';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { getWindow } from '@/logic/windows';
import queryClient from '@/queryClient';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { createState } from '../base';
import { BasedChatState, ChatState } from './type';
import clubReducer from './clubReducer';
import { useGroups } from '../groups';
import {
  CacheId,
  PostStatus,
  TrackedPost,
  channelAction,
} from '../channel/channel';
import emptyMultiDm from './utils';

setAutoFreeze(false);

export interface State {
  trackedWrits: TrackedPost[];
  addTracked: (id: CacheId) => void;
  updateStatus: (id: CacheId, status: PostStatus) => void;
  getStatus: (id: CacheId) => PostStatus;
  [key: string]: unknown;
}

export const useWritsStore = create<State>((set, get) => ({
  trackedWrits: [],
  addTracked: (id) => {
    set((state) => ({
      trackedPosts: [{ status: 'pending', cacheId: id }, ...state.trackedWrits],
    }));
  },
  updateStatus: (id, s) => {
    console.log(`updating ${id} to status: ${s}`);
    set((state) => ({
      trackedPosts: state.trackedWrits.map(({ cacheId, status }) => {
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
}));

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

export function initializeChat({
  dms,
  clubs,
  pins,
  invited,
  unreads,
}: {
  dms: string[];
  clubs: Clubs;
  pins: string[];
  invited: string[];
  unreads: DMUnreads;
}) {
  queryClient.setQueryData(['dms', 'dms'], () => dms || []);
  queryClient.setQueryData(['dms', 'multi'], () => clubs || {});
  queryClient.setQueryData(['dms', 'pending'], () => invited || []);
  queryClient.setQueryData(['dms', 'pins'], () => ({ pins: pins || [] }));
  queryClient.setQueryData(['dms', 'unreads'], () => unreads || {});
}

interface PageParam {
  time: BigInteger;
  direction: string;
}

interface InfiniteDMsData {
  pages: PagedWrits[];
  pageParams: PageParam[];
}

function infiniteDMsUpdater(queryKey: QueryKey, data: WritDiff | WritResponse) {
  console.log('infinite updater');

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
    console.log('invalid args, bailing');
    return;
  }

  console.log(`id: ${id}`);
  console.log('delta:', delta);

  if ('add' in delta) {
    console.log('handling add delta');
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

      const cachedWrit = lastPage.writs[unixToDa(writ.essay.sent).toString()];

      console.log({ cachedWrit, lastPageWrits: lastPage.writs });

      if (
        cachedWrit &&
        time.toString() !== unixToDa(writ.essay.sent).toString()
      ) {
        // remove cached post if it exists
        delete newLastPage.writs[unixToDa(writ.essay.sent).toString()];

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
    console.log(`reply delta found`);
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
          console.log('looks like we have it');

          const replyId = writFind[0];
          const replyingWrit = writFind[1];
          console.log(`reply id`, replyId);
          console.log(`replying writ`, replyingWrit);

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

          console.log(`cached page index: ${pageInCacheIdx}`);

          if (pageInCache === undefined) {
            return queryData;
          }

          console.log('returning updated data');
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

        console.log('no luck, returning existing data');

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

          console.log('got a reply, not in cache. Adding');

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

// async function updateWritInCache(
//   variables: { whom: string; postId: string },
//   updater: (post: PostDataResponse | undefined) => PostDataResponse | undefined
// ) {
//   const [han, flag] = nestToFlag(variables.nest);
//   await queryClient.cancelQueries([han, 'posts', flag, variables.postId]);

//   queryClient.setQueryData([han, 'posts', flag, variables.postId], updater);
// }

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
    path: '/club/new',
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
    queryKey: ['dms', 'pending'],
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

export function usePinned() {
  const { data } = useReactQueryScry<Pins>({
    queryKey: ['dms', 'pins'],
    app: 'chat',
    path: '/pins',
  });

  if (!data || !data.pins) {
    return [];
  }

  return data.pins;
}

export function usePinnedDms() {
  const pinned = usePinned();
  return useMemo(() => pinned.filter(whomIsDm), [pinned]);
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

export function usePinnedClubs() {
  const pinned = usePinned();
  return useMemo(() => pinned.filter(whomIsMultiDm), [pinned]);
}

export function useTogglePinMutation() {
  const pins = usePinned();

  const mutationFn = async ({ whom, pin }: { whom: string; pin: boolean }) => {
    const newPins = pin ? [...pins, whom] : pins.filter((w) => w !== whom);

    await api.poke<Pins>({
      app: 'chat',
      mark: 'chat-pins',
      json: {
        pins: newPins,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      queryClient.setQueryData<DMWhom[]>(['dms', 'pins'], () => {
        const { whom, pin } = variables;
        const currentPins = pins || [];
        const newPins = pin
          ? [...currentPins, whom]
          : currentPins.filter((w) => w !== whom);
        return newPins;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'pins']);
    },
  });
}

const emptyUnreads: DMUnreads = {};
export function useDmUnreads() {
  const { data, ...query } = useReactQuerySubscription<
    DMUnreads,
    DMUnreadUpdate
  >({
    queryKey: ['dms', 'unreads'],
    app: 'chat',
    path: '/unreads',
    scry: '/unreads',
  });

  if (!data) {
    return {
      ...query,
      data: emptyUnreads,
    };
  }

  return {
    ...query,
    data,
  };
}

export function useDmUnread(whom: string) {
  const unreads = useDmUnreads();
  return unreads.data[whom];
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

export async function optimisticDMAction(
  whom: string,
  id: string,
  delta: WritDelta
) {
  const { action } = getActionAndEvent(whom, id, delta);
  const queryKey = ['dms', whom, 'infinite'];

  infiniteDMsUpdater(queryKey, { id, delta });
  await api.poke<ClubAction | DmAction>(action);
}

export function useArchiveDm() {
  const mutationFn = async ({ whom }: { whom: string }) => {
    await api.poke({
      app: 'chat',
      mark: 'dm-archive',
      json: whom,
    });
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom } = variables;
      queryClient.setQueryData(
        ['dms', 'unreads'],
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
      queryClient.invalidateQueries(['dms', 'unreads']);
    },
  });
}

export function useUnarchiveDm() {
  const mutationFn = async ({ ship }: { ship: string }) => {
    await api.poke({
      app: 'chat',
      mark: 'dm-unarchive',
      json: ship,
    });
  };

  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'unreads']);
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
      mark: 'dm-rsvp',
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
      queryClient.setQueryData(
        ['dms', 'unreads'],
        (unreads: DMUnreads | undefined) => {
          if (!unreads) {
            return unreads;
          }

          const newUnreads = { ...unreads };

          if (!accept) {
            delete newUnreads[ship];
          }

          return newUnreads;
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'unreads']);
    },
  });
}

export function useCreateMultiDm() {
  const mutationFn = async ({ id, hive }: { id: string; hive: string[] }) => {
    await api.poke({
      app: 'chat',
      mark: 'club-create',
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
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'multi']);
    },
  });
}

export function useEditMultiDm() {
  const mutationFn = async ({ id, meta }: { id: string; meta: GroupMeta }) => {
    await api.poke({
      app: 'chat',
      mark: 'club-edit',
      json: {
        id,
        meta,
      },
    });
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
    onSettled: () => {
      queryClient.invalidateQueries(['dms', 'multi']);
    },
  });
}

export interface SendMessageVariables {
  whom: string;
  message: {
    id: string;
    delta: WritDeltaAdd | ReplyDelta;
    cacheId: {
      author: string;
      sent: number;
    };
  };
  replying?: string;
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
        trackedPosts: state.trackedWrits.filter((p) => p.cacheId !== cacheId),
      }));
    },
    onSettled: (_data, _error, variables) => {
      const { whom, parentId } = variables;
      const infiniteQueryKey = ['dms', whom, 'infinite'];
      const parentWritQueryKey = ['dms', whom, parentId];

      queryClient.refetchQueries(parentWritQueryKey);
      queryClient.invalidateQueries(infiniteQueryKey);
    },
  });
}

export function useSendMessage() {
  const mutationFn = async ({
    whom,
    message,
    replying,
  }: SendMessageVariables) => {
    const { action } = getActionAndEvent(
      whom,
      replying || message.id,
      message.delta
    );
    await api.poke<ClubAction | DmAction>(action);
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom, message, replying } = variables;
      const queryKey = ['dms', whom, 'infinite'];
      const sentAsId =
        'add' in message.delta
          ? unixToDa(message.delta.add.memo.sent).toString()
          : '';

      console.log(
        `tracking cache id ${message.cacheId.author} ${message.cacheId.sent}`
      );
      useWritsStore.getState().addTracked(message.cacheId);

      infiniteDMsUpdater(queryKey, {
        id: replying || sentAsId,
        delta: message.delta,
      });
    },
    onSuccess: async (_data, variables) => {
      const { cacheId } = variables.message;
      const status = useWritsStore.getState().getStatus(cacheId);
      if (status === 'pending') {
        useWritsStore.getState().updateStatus(cacheId, 'sent');
      }
      queryClient.removeQueries([
        'dms',
        variables.whom,
        cacheId.author,
        cacheId.sent,
      ]);
    },
    onError: async (_error, variables) => {
      const { cacheId } = variables.message;
      useWritsStore.setState((state) => ({
        ...state,
        trackedPosts: state.trackedWrits.filter((p) => p.cacheId !== cacheId),
      }));
      queryClient.setQueryData(
        ['dms', variables.whom, cacheId.author, cacheId.sent],
        undefined
      );
    },
    onSettled: (_data, _error, variables) => {
      const { whom } = variables;
      const queryKey = ['dms', whom, 'infinite'];
      queryClient.invalidateQueries(queryKey);
    },
  });
}

export function useDeleteDm() {
  const mutationFn = async ({ whom, id }: { whom: string; id: string }) => {
    const delta = { del: null };
    if (whomIsDm(whom)) {
      await api.trackedPoke<DmAction, DmAction>(
        dmAction(whom, delta, id),
        { app: 'chat', path: whom },
        (event) => event.ship === id && 'del' in event.diff
      );
    } else {
      await api.trackedPoke<ClubAction>(
        multiDmAction(whom, { writ: { id, delta } }),
        { app: 'chat', path: whom }
      );
    }
  };

  return useMutation({
    mutationFn,
    onMutate: (variables) => {
      const { whom } = variables;
      const delta = { del: null };
      const queryKey = ['dms', whom, 'infinite'];
      infiniteDMsUpdater(queryKey, { id: whom, delta });
    },
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

export function useInfiniteDMs(whom: string, initialTime?: string) {
  const isDM = useMemo(() => whomIsDm(whom), [whom]);
  const type = useMemo(() => (isDM ? 'dm' : 'club'), [isDM]);
  const queryKey = useMemo(() => ['dms', whom, 'infinite'], [whom]);

  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      },
      300,
      {
        leading: true,
        trailing: true,
      }
    )
  );

  useEffect(() => {
    api.subscribe({
      app: 'chat',
      path: `/${type}/${whom}${isDM ? '' : '/writs'}`,
      event: (data: WritResponse) => {
        infiniteDMsUpdater(queryKey, data);
        invalidate.current();
      },
    });
  }, [whom, type, isDM, queryKey]);

  const { data, ...rest } = useInfiniteQuery<PagedWrits>({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam?: PageParam }) => {
      let path = '';

      if (pageParam) {
        const { time, direction } = pageParam;
        const ud = decToUd(time.toString());
        path = `/${type}/${whom}/writs/${direction}/${ud}/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/light`;
      } else if (initialTime) {
        path = `/${type}/${whom}/writs/around/${decToUd(initialTime)}/${
          INITIAL_MESSAGE_FETCH_PAGE_SIZE / 2
        }/light`;
      } else {
        path = `/${type}/${whom}/writs/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/light`;
      }

      const response = await api.scry<PagedWrits>({
        app: 'chat',
        path,
      });

      return {
        ...response,
      };
    },
    getNextPageParam: (lastPage): PageParam | undefined => {
      const { newer } = lastPage;

      if (!newer) {
        return undefined;
      }

      return {
        time: bigInt(newer),
        direction: 'newer',
      };
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      const { older } = firstPage;

      if (!older) {
        return undefined;
      }

      return {
        time: bigInt(older),
        direction: 'older',
      };
    },
    refetchOnMount: false,
    retryOnMount: false,
    retry: false,
  });

  if (data === undefined || data.pages.length === 0) {
    return {
      writs: [] as WritTuple[],
      data,
      ...rest,
    };
  }

  const writs: WritTuple[] = data.pages
    .map((page) => {
      const writPages = Object.entries(page.writs).map(
        ([k, v]) => [bigInt(udToDec(k)), v] as WritTuple
      );
      return writPages;
    })
    .flat()
    .sort(([a], [b]) => a.compare(b));

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
      return `/dm/${whom}`;
    }

    return `/club/${whom}`;
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
  return Boolean(unread?.count > 0 && unread['read-id']);
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
