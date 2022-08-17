import bigInt, { BigInteger } from 'big-integer';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import { persist } from 'zustand/middleware';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, unixToDa } from '@urbit/api';
import { useCallback, useMemo } from 'react';
import {
  CurioDelta,
  Heap,
  HeapBriefs,
  HeapBriefUpdate,
  HeapCurio,
  HeapDiff,
  HeapFlag,
  HeapPerm,
  Stash,
} from '@/types/heap';
import api from '@/api';
import {
  createStorageKey,
  clearStorageMigration,
  storageVersion,
} from '@/logic/utils';
import { HeapState } from './type';
import makeCuriosStore from './curios';

setAutoFreeze(false);

function heapAction(flag: HeapFlag, diff: HeapDiff) {
  return {
    app: 'heap',
    mark: 'heap-action',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

function heapCurioDiff(flag: HeapFlag, time: number, delta: CurioDelta) {
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

export const useHeapState = create<HeapState>(
  persist<HeapState>(
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
      heapSubs: [],
      briefs: {},
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
      start: async () => {
        // TODO: parallelise
        api
          .scry<HeapBriefs>({
            app: 'heap',
            path: '/briefs',
          })
          .then((briefs) => {
            get().batchSet((draft) => {
              draft.briefs = briefs;
            });
          });

        api
          .scry<Stash>({
            app: 'heap',
            path: '/stash',
          })
          .then((chats) => {
            get().batchSet((draft) => {
              draft.stash = chats;
            });
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
      },
      joinHeap: async (flag) => {
        await api.poke({
          app: 'heap',
          mark: 'flag',
          json: flag,
        });
      },
      leaveHeap: async (flag) => {
        await api.poke({
          app: 'chat',
          mark: 'heap-leave',
          json: flag,
        });
      },
      addCurio: async (flag, heart) => {
        await api.poke(heapCurioDiff(flag, Date.now(), { add: heart }));
      },
      delCurio: async (flag, time) => {
        await api.poke(heapCurioDiff(flag, time, { del: null }));
      },
      create: async (req) => {
        await api.poke({
          app: 'heap',
          mark: 'heap-create',
          json: req,
        });
      },
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
      delSects: async (flag, sects) => {
        await api.poke(heapAction(flag, { 'del-sects': sects }));
        const perms = await api.scry<HeapPerm>({
          app: 'chat',
          path: `/heap/${flag}/perm`,
        });
        get().batchSet((draft) => {
          draft.stash[flag].perms = perms;
        });
      },
      initialize: async (flag) => {
        if (get().heapSubs.includes(flag)) {
          return;
        }

        const perms = await api.scry<HeapPerm>({
          app: 'heap',
          path: `/heap/${flag}/perm`,
        });
        get().batchSet((draft) => {
          const heap = { perms };
          draft.stash[flag] = heap;
          draft.heapSubs.push(flag);
        });

        await makeCuriosStore(
          flag,
          get,
          `/heap/${flag}/curios`,
          `/heap/${flag}/ui/curios`
        ).initialize();
      },
    }),
    {
      name: createStorageKey('heap'),
      version: storageVersion,
      migrate: clearStorageMigration,
      partialize: ({ stash }) => ({
        stash,
      }),
    }
  )
);

export function useCuriosForHeap(flag: HeapFlag) {
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

export function useHeapIsJoined(flag: HeapFlag) {
  return useHeapState(
    useCallback((s) => Object.keys(s.briefs).includes(flag), [flag])
  );
}

export function useCurios(flag: HeapFlag) {
  return useHeapState(useCallback((s) => s.curios[flag], [flag]));
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
      .map((r: number) => {
        const t = bigInt(r);
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
  return useHeapState(
    useCallback(
      (s) => {
        const curios = s.curios[flag];
        if (!curios) {
          return undefined;
        }

        const t = bigInt(time);
        return [t, curios.get(t)] as const;
      },
      [flag, time]
    )
  );
}

export function useHeap(flag: HeapFlag): Heap | undefined {
  return useHeapState(useCallback((s) => s.stash[flag], [flag]));
}

export function useBriefs() {
  return useHeapState(useCallback((s: HeapState) => s.briefs, []));
}
