import _ from 'lodash';
import bigInt, { BigInteger } from 'big-integer';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { useCallback, useEffect, useMemo } from 'react';
import {
  CurioDelta,
  Heap,
  HeapAction,
  HeapBriefUpdate,
  HeapCurio,
  HeapDiff,
  HeapFlag,
  HeapPerm,
  HeapSaid,
  HeapDisplayMode,
  HeapJoin,
  HeapCreate,
  HeapCurios,
  HeapCurioMap,
  HeapCurioTuple,
  CurioHeart,
  HeapUpdate,
  HeapCurioWithComments,
  HeapBriefs,
  Stash,
} from '@/types/heap';
import api from '@/api';
import { nestToFlag, canWriteChannel, restoreMap } from '@/logic/utils';
import useNest from '@/logic/useNest';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQueryScry from '@/logic/useReactQueryScry';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HeapState } from './type';
import makeCuriosStore from './curios';
import { useGroup, useVessel } from '../groups';
import { createState } from '../base';
import useSchedulerStore from '../scheduler';

const CURIO_PAGE_SIZE = 250;

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

function heapAction(flag: HeapFlag, diff: HeapDiff) {
  return {
    app: 'heap',
    mark: 'heap-action-0',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

function heapCurioDiff(flag: HeapFlag, time: string, delta: CurioDelta) {
  return heapAction(flag, {
    curios: {
      time,
      delta,
    },
  });
}

function getTime() {
  return decToUd(unixToDa(Date.now()).toString());
}

function useBriefsNew(): HeapBriefs {
  const emptyBriefs = useMemo(() => ({} as HeapBriefs), []);

  const { data } = useReactQuerySubscription({
    queryKey: ['heap', 'briefs'],
    app: 'heap',
    path: '/briefs',
    scry: '/breifs',
  });

  return data ? (data as HeapBriefs) : emptyBriefs;
}

export function useHeapBrief(flag: HeapFlag) {
  const briefs = useBriefsNew();
  return briefs[flag];
}

export function useStash(): Stash {
  const emptyStash = useMemo(() => ({} as Stash), []);
  const { data } = useReactQuerySubscription({
    queryKey: ['heap', 'stash'],
    app: 'heap',
    path: '/ui',
    scry: '/stash',
  });

  return data ? (data as Stash) : emptyStash;
}

export function useHeapNew(flag: HeapFlag) {
  const stash = useStash();
  return stash[flag];
}

export function useHeapPermsNew(flag: HeapFlag) {
  const defaultPerms = useMemo(() => ({ writers: [] }), []);
  const stash = useStash();

  if (!stash) {
    return defaultPerms;
  }

  return stash[flag]?.perms || defaultPerms;
}

export function useCanWriteToHeapNew(groupFlag: string) {
  const group = useGroup(groupFlag);
  const vessel = useVessel(groupFlag, window.our);
  const nest = useNest();
  const perms = useHeapPermsNew(nest);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  return canWrite;
}

export function useHeapIsJoinedNew(flag: HeapFlag) {
  const briefs = useBriefsNew();
  return useMemo(() => _.has(briefs, flag), [flag, briefs]);
}

export function useCreateHeapMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async (variables: HeapCreate) => {
    await api.trackedPoke<HeapCreate, HeapAction>(
      {
        app: 'heap',
        mark: 'heap-create',
        json: variables,
      },
      { app: 'heap', path: '/ui' },
      (event) => {
        const { update, flag } = event;
        return (
          'create' in update.diff && flag === `${window.our}/${variables.name}`
        );
      }
    );
  };

  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.refetchQueries(['heap', 'briefs']);
      await queryClient.refetchQueries(['heap', 'stash']);
    },
  });
}

export function useJoinHeapMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async ({
    group,
    chan,
  }: {
    group: string;
    chan: string;
  }) => {
    await api.trackedPoke<HeapJoin, HeapAction>(
      {
        app: 'heap',
        mark: 'channel-join',
        json: {
          group,
          chan,
        },
      },
      { app: 'heap', path: 'ui' },
      (event) => event.flag === chan && 'create' in event.update.diff
    );
  };

  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.refetchQueries(['heap', 'breifs']);
      await queryClient.refetchQueries(['heap', 'stash']);
    },
  });
}

export function useLeaveHeapMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async (variables: { flag: HeapFlag }) => {
    await api.poke({
      app: 'heap',
      mark: 'heap-leave',
      json: variables.flag,
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['heap', 'stash']);
      await queryClient.cancelQueries(['heap', 'breifs']);
      await queryClient.cancelQueries(['heap', 'perms', variables.flag]);
      await queryClient.cancelQueries(['heap', 'blocks', variables.flag]);

      queryClient.removeQueries(['heap', 'perms', variables.flag]);
      queryClient.removeQueries(['heap', 'blocks', variables.flag]);
    },
    onSettled: async (variables) => {
      await queryClient.refetchQueries(['heap', 'briefs']);
      await queryClient.refetchQueries(['heap', 'stash']);
    },
  });
}

export function useAddHeapSectsMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async ({
    flag,
    sects,
  }: {
    flag: HeapFlag;
    sects: string[];
  }) => {
    await api.poke(heapAction(flag, { 'add-sects': sects }));
  };

  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.refetchQueries(['heap', 'stash']);
    },
  });
}

export function useDelHeapSectsMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async ({
    flag,
    sects,
  }: {
    flag: HeapFlag;
    sects: string[];
  }) => {
    await api.poke(heapAction(flag, { 'del-sects': sects }));
  };

  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.refetchQueries(['heap', 'stash']);
    },
  });
}

export function useAddCurioFeelMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async ({
    flag,
    time,
    feel,
  }: {
    flag: HeapFlag;
    time: string;
    feel: string;
  }) => {
    const ud = decToUd(time);
    await api.poke(
      heapCurioDiff(flag, ud, {
        'add-feel': {
          time: ud,
          feel,
          ship: window.our,
        },
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
      await queryClient.cancelQueries(['heap', variables.flag, 'blocks']);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
      await queryClient.refetchQueries(['heap', variables.flag, 'blocks']);
    },
  });
}

export function useDelCurioFeelMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async ({
    flag,
    time,
    feel,
  }: {
    flag: HeapFlag;
    time: string;
    feel: string;
  }) => {
    const ud = decToUd(time);
    await api.poke(heapCurioDiff(flag, ud, { 'del-feel': time }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
      await queryClient.cancelQueries(['heap', variables.flag, 'blocks']);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
      await queryClient.refetchQueries(['heap', variables.flag, 'blocks']);
    },
  });
}

function formatCurios(curios: HeapCurios): HeapCurioMap {
  let curioMap = restoreMap<HeapCurio>({});
  Object.entries(curios)
    .map(([k, curio]) => ({ tim: bigInt(udToDec(k)), curio }))
    .forEach(({ tim, curio }) => {
      curioMap = curioMap.set(tim, curio);
    });

  return curioMap;
}

export function useCurioBlocks(flag: HeapFlag): HeapCurioMap {
  const def = useMemo(() => new BigIntOrderedMap<HeapCurio>(), []);

  const { data, isLoading, isError, ...rest } = useReactQuerySubscription({
    queryKey: ['heap', 'curios', flag],
    app: 'heap',
    path: `/heap/${flag}/ui`,
    scry: `/heap/${flag}/curios/newest/${CURIO_PAGE_SIZE}/blocks`,
    options: {
      keepPreviousData: true,
      refetchOnMount: true,
      retryOnMount: true,
    },
  });

  return data ? formatCurios(data as HeapCurios) : def;
}

export function useCurioWithComments(flag: HeapFlag, time: string) {
  const ud = useMemo(() => decToUd(time), [time]);
  const { data, ...query } = useReactQueryScry<HeapCurios>({
    queryKey: ['heap', 'curios', flag, 'curio', time],
    app: 'heap',
    path: `/heap/${flag}/curios/curio/id/${ud}/full`,
    options: {
      keepPreviousData: true,
      refetchOnMount: true,
      retryOnMount: true,
    },
  });

  return useMemo(() => {
    if (!data) {
      return { ...query, time: bigInt(time), curio: null, comments: null };
    }

    const curio = _.get(data, ud);
    const comments = _.omit(data, ud);

    return {
      ...query,
      time: bigInt(time),
      curio,
      comments: formatCurios(comments),
    };
  }, [time, ud, data, query]);
}

export function useAddCurioMutation(flag: HeapFlag) {
  const queryClient = useQueryClient();
  const mutationFn = async ({
    heart,
  }: {
    heart: CurioHeart;
    parentKey?: string;
  }) =>
    new Promise<void>((resolve) => {
      const diff = heapCurioDiff(flag, getTime(), { add: heart });
      api
        .trackedPoke<HeapAction, HeapUpdate>(
          diff,
          { app: 'diary', path: `/heap/${flag}/ui` },
          (event) => {
            const { diff: eventDiff } = event;
            if ('curios' in eventDiff) {
              const { delta } = eventDiff.curios;
              if ('add' in delta && delta.add.sent === heart.sent) {
                return true;
              }
            }
            return false;
          }
        )
        .then(() => resolve());
    });

  return useMutation({
    mutationFn,
  });
}

export function useDelCurioMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async ({
    flag,
    time,
  }: {
    flag: HeapFlag;
    time: string;
  }) => {
    const ud = decToUd(time);
    await api.poke(heapCurioDiff(flag, ud, { del: null }));
  };

  return useMutation({
    mutationFn,
    onSuccess: async (_data, variables) => {
      queryClient.removeQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['heap', variables.flag, 'blocks']);
      await queryClient.invalidateQueries(['heap', variables.flag]);
    },
  });
}

export function useEditCurioMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async ({
    flag,
    time,
    heart,
  }: {
    flag: HeapFlag;
    time: string;
    heart: CurioHeart;
  }) => {
    const ud = decToUd(time);
    await api.poke(heapCurioDiff(flag, ud, { edit: heart }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['heap', variables.flag, 'blocks']);
      await queryClient.refetchQueries([
        'heap',
        variables.flag,
        'curio',
        variables.time,
      ]);
    },
  });
}

export function useMarkHeapReadMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async ({ flag }: { flag: HeapFlag }) => {
    await api.poke({
      app: 'heap',
      mark: 'heap-remark-action',
      json: {
        flag,
        diff: { read: null },
      },
    });
  };

  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.refetchQueries(['heap', 'briefs']);
    },
  });
}

// export function useCommentsNew(flag: HeapFlag, time: string) {
//   const curios = useCuriosNew(flag);
//   return useMemo(() => {
//     if (!curios) {
//       return new BigIntOrderedMap<HeapCurio>();
//     }

//     const curio = curios.get(bigInt(time));
//     const replies = (curio?.seal?.replied || ([] as number[]))
//       .map((r: string) => {
//         const t = bigInt(udToDec(r));
//         const c = curios.get(t);
//         return c ? ([t, c] as const) : undefined;
//       })
//       .filter((r: unknown): r is [BigInteger, HeapCurio] => !!r) as [
//       BigInteger,
//       HeapCurio
//     ][];
//     return new BigIntOrderedMap<HeapCurio>().gas(replies);
//   }, [curios, time]);
// }

export function useOrderedCuriosNew(
  flag: HeapFlag,
  currentId: bigInt.BigInteger | string
) {
  const curios = useCurioBlocks(flag);
  const sortedCurios = Array.from(curios).filter(
    ([, c]) => c.heart.replying === null
  );
  sortedCurios.sort(([a], [b]) => b.compare(a));

  const curioId = typeof currentId === 'string' ? bigInt(currentId) : currentId;
  const hasNext = curios.size > 0 && curioId.lt(curios.peekLargest()[0]);
  const hasPrev = curios.size > 0 && curioId.gt(curios.peekSmallest()[0]);
  const currentIdx = sortedCurios.findIndex(([i, _c]) => i.eq(curioId));
  const nextCurio = hasNext ? sortedCurios[currentIdx - 1] : null;
  const prevCurio = hasPrev ? sortedCurios[currentIdx + 1] : null;

  return {
    hasNext,
    hasPrev,
    nextCurio,
    prevCurio,
    sortedCurios,
  };
}

export const useHeapState = createState<HeapState>(
  'heap',
  (set, get) => ({
    set: (fn) => {
      set(produce(get(), fn));
    },
    batchSet: (fn) => {
      batchUpdates(() => {
        get().set(fn);
      });
    },
    stash: {},
    curios: {},
    loadedRefs: {},
    briefs: {},
    pendingImports: {},
    // donezo
    markRead: async (flag) => {
      await api.poke({
        app: 'heap',
        mark: 'heap-remark-action',
        json: {
          flag,
          diff: { read: null },
        },
      });
    },
    // eliminated
    start: async ({ briefs, stash }) => {
      get().batchSet((draft) => {
        draft.briefs = briefs;
        draft.stash = stash;
      });

      api.subscribe({
        app: 'heap',
        path: '/briefs',
        event: (event: unknown, mark: string) => {
          if (mark === 'heap-leave') {
            get().batchSet((draft) => {
              delete draft.briefs[event as string];
            });
            return;
          }

          const { flag, brief } = event as HeapBriefUpdate;
          get().batchSet((draft) => {
            draft.briefs[flag] = brief;
          });
        },
      });

      api.subscribe({
        app: 'heap',
        path: '/ui',
        event: (event: HeapAction) => {
          get().batchSet((draft) => {
            const {
              flag,
              update: { diff },
            } = event;
            const heap = draft.stash[flag];

            if ('view' in diff) {
              heap.view = diff.view;
            } else if ('del-sects' in diff) {
              heap.perms.writers = heap.perms.writers.filter(
                (w) => !diff['del-sects'].includes(w)
              );
            } else if ('add-sects' in diff) {
              heap.perms.writers = heap.perms.writers.concat(diff['add-sects']);
            }
          });
        },
      });
    },
    // donezo
    joinHeap: async (group, chan) => {
      await api.trackedPoke<HeapJoin, HeapAction>(
        {
          app: 'heap',
          mark: 'channel-join',
          json: {
            group,
            chan,
          },
        },
        { app: 'heap', path: 'ui' },
        (event) => event.flag === chan && 'create' in event.update.diff
      );
    },
    // donezo
    leaveHeap: async (flag) => {
      await api.poke({
        app: 'heap',
        mark: 'heap-leave',
        json: flag,
      });
    },
    // unneeded?
    viewHeap: async (flag, view) => {
      await api.poke(
        heapAction(flag, {
          view,
        })
      );
    },
    // donezo
    addCurio: async (flag, heart) => {
      await api.poke(heapCurioDiff(flag, getTime(), { add: heart }));
    },
    // kind of donezo?
    delCurio: async (flag, time) => {
      const ud = decToUd(time);
      await api.poke(heapCurioDiff(flag, ud, { del: null }));
    },
    // donezo
    editCurio: async (flag, time, heart) => {
      const ud = decToUd(time);
      await api.poke(heapCurioDiff(flag, ud, { edit: heart }));
    },
    // donezo
    create: async (req) => {
      get().batchSet((draft) => {
        const flag = `${window.our}/${req.name}`;
        draft.stash[flag] = {
          perms: { writers: [], group: req.group },
          view: 'grid',
          saga: null,
        };
        draft.curios[flag] = new BigIntOrderedMap<HeapCurio>();
      });
      await api.trackedPoke<HeapCreate, HeapAction>(
        {
          app: 'heap',
          mark: 'heap-create',
          json: req,
        },
        { app: 'heap', path: '/ui' },
        (event) => {
          const { update, flag } = event;
          return (
            'create' in update.diff && flag === `${window.our}/${req.name}`
          );
        }
      );
    },
    // donezo
    addSects: async (flag, sects) => {
      await api.poke(heapAction(flag, { 'add-sects': sects }));
      const perms = await api.scry<HeapPerm>({
        app: 'heap',
        path: `/heap/${flag}/perm`,
      });
      get().batchSet((draft) => {
        draft.stash[flag].perms = perms;
      });
    },
    // donezo
    delSects: async (flag, sects) => {
      await api.poke(heapAction(flag, { 'del-sects': sects }));
      const perms = await api.scry<HeapPerm>({
        app: 'heap',
        path: `/heap/${flag}/perm`,
      });
      get().batchSet((draft) => {
        draft.stash[flag].perms = perms;
      });
    },
    // don't need
    fetchCurio: async (flag, time) => {
      const ud = decToUd(time);
      const curio = await api.scry<HeapCurio>({
        app: 'heap',
        path: `/heap/${flag}/curios/curio/id/${ud}`,
      });
      get().batchSet((draft) => {
        draft.curios[flag] = draft.curios[flag].set(bigInt(time), curio);
      });
    },
    // donezo
    addFeel: async (flag, time, feel) => {
      const ud = decToUd(time);
      await api.poke(
        heapCurioDiff(flag, ud, {
          'add-feel': {
            time: ud,
            feel,
            ship: window.our,
          },
        })
      );
    },
    // donezo
    delFeel: async (flag, time) => {
      const ud = decToUd(time);
      await api.poke(
        heapCurioDiff(flag, ud, {
          'del-feel': window.our,
        })
      );
    },
    // don't need
    initialize: async (flag) => {
      useSchedulerStore.getState().wait(async () => {
        const perms = await api.scry<HeapPerm>({
          app: 'heap',
          path: `/heap/${flag}/perm`,
        });
        get().batchSet((draft) => {
          const heap = { perms, view: 'grid' as HeapDisplayMode, saga: null };
          draft.stash[flag] = heap;
        });
      }, 1);

      await makeCuriosStore(
        flag,
        get,
        `/heap/${flag}/curios`,
        `/heap/${flag}/ui`
      ).initialize();
    },
    // TODO: understand
    initImports: (init) => {
      get().batchSet((draft) => {
        draft.pendingImports = init;
      });
    },
  }),
  // this is for persisting zustand state
  {
    partialize: (state) => {
      const saved = _.pick(state, ['briefs', 'stash', 'curios']);

      return saved;
    },
    merge: (state, current) => {
      const curios: {
        [flag: HeapFlag]: HeapCurioMap;
      } = {};

      Object.entries(state.curios).forEach(([k, c]) => {
        curios[k] = restoreMap<HeapCurio>(c);
      });

      return {
        ...current,
        ...state,
        curios,
      };
    },
  },
  []
);

export function useCurios(flag: HeapFlag) {
  const def = useMemo(() => new BigIntOrderedMap<HeapCurio>(), []);
  return useHeapState(useCallback((s) => s.curios[flag] || def, [flag, def]));
}

const defaultPerms = {
  writers: [],
};

export function useHeapPerms(flag: HeapFlag) {
  return useHeapState(
    useCallback((s) => s.stash[flag]?.perms || defaultPerms, [flag])
  );
}

export function useCanWriteToHeap(groupFlag: string) {
  const group = useGroup(groupFlag);
  const vessel = useVessel(groupFlag, window.our);
  const nest = useNest();
  const perms = useHeapPerms(nest);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  return canWrite;
}

export function useHeapIsJoined(flag: HeapFlag) {
  return useHeapState(
    useCallback((s) => Object.keys(s.briefs).includes(flag), [flag])
  );
}

export function useAllCurios() {
  return useHeapState(useCallback((s) => s.curios, []));
}

export function useCurrentCuriosSize(flag: HeapFlag) {
  return useHeapState(useCallback((s) => s.curios[flag]?.size ?? 0, [flag]));
}

export function useComments(flag: HeapFlag, time: string) {
  const curios = useCurios(flag);
  return useMemo(() => {
    if (!curios) {
      return new BigIntOrderedMap<HeapCurio>();
    }

    const curio = curios.get(bigInt(time));
    const replies = (curio?.seal?.replied || ([] as number[]))
      .map((r: string) => {
        const t = bigInt(udToDec(r));
        const c = curios.get(t);
        return c ? ([t, c] as const) : undefined;
      })
      .filter((r: unknown): r is [BigInteger, HeapCurio] => !!r) as [
      BigInteger,
      HeapCurio
    ][];
    return new BigIntOrderedMap<HeapCurio>().gas(replies);
  }, [curios, time]);
}

export function useCurio(flag: HeapFlag, time: string) {
  const curios = useCurios(flag);
  return useMemo(() => {
    const t = bigInt(time);

    if (curios.size === 0 || !curios.has(t)) {
      return undefined;
    }

    return [t, curios.get(t)] as const;
  }, [time, curios]);
}

export function useHeap(flag: HeapFlag): Heap | undefined {
  return useHeapState(useCallback((s) => s.stash[flag], [flag]));
}

export function useBriefs() {
  return useHeapState(useCallback((s: HeapState) => s.briefs, []));
}

export function useOrderedCurios(
  flag: HeapFlag,
  currentId: bigInt.BigInteger | string
) {
  const curios = useCurios(flag);
  const sortedCurios = Array.from(curios).filter(
    ([, c]) => c.heart.replying === null
  );
  sortedCurios.sort(([a], [b]) => b.compare(a));

  const curioId = typeof currentId === 'string' ? bigInt(currentId) : currentId;
  const hasNext = curios.size > 0 && curioId.lt(curios.peekLargest()[0]);
  const hasPrev = curios.size > 0 && curioId.gt(curios.peekSmallest()[0]);
  const currentIdx = sortedCurios.findIndex(([i, _c]) => i.eq(curioId));
  const nextCurio = hasNext ? sortedCurios[currentIdx - 1] : null;
  const prevCurio = hasPrev ? sortedCurios[currentIdx + 1] : null;

  return {
    hasNext,
    hasPrev,
    nextCurio,
    prevCurio,
    sortedCurios,
  };
}

export function useGetLatestCurio() {
  const def = useMemo(() => new BigIntOrderedMap<HeapCurio>(), []);
  const empty = [bigInt(), null];
  const allCurios = useAllCurios();

  return (chFlag: string) => {
    const curioFlag = chFlag.startsWith('~') ? chFlag : nestToFlag(chFlag)[1];
    const curios = allCurios[curioFlag] ?? def;
    return curios.size > 0 ? curios.peekLargest() : empty;
  };
}

const { shouldLoad, newAttempt, finished } = getPreviewTracker();

const selRefs = (s: HeapState) => s.loadedRefs;
export function useRemoteCurio(flag: string, time: string, blockLoad: boolean) {
  const refs = useHeapState(selRefs);
  const path = `/said/${flag}/curio/${decToUd(time)}`;
  const cached = refs[path];

  useEffect(() => {
    if (!blockLoad && shouldLoad(path)) {
      newAttempt(path);
      subscribeOnce<HeapSaid>('heap', path)
        .then(({ curio }) => {
          useHeapState.getState().batchSet((draft) => {
            draft.loadedRefs[path] = curio;
          });
        })
        .finally(() => finished(path));
    }
  }, [path, blockLoad]);

  return cached;
}

(window as any).heap = useHeapState.getState;
