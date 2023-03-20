import api from '@/api';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import {
  asyncWithDefault,
  clearStorageMigration,
  createStorageKey,
  getFlagParts,
  storageVersion,
} from '@/logic/utils';
import produce from 'immer';
import { useEffect, useCallback } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface LureMetadata {
  tag: string;
  fields: Record<string, string | undefined>;
}

interface Lure {
  url: string;
  enabled?: boolean;
  metadata?: LureMetadata;
}

interface Bait {
  ship: string;
  url: string;
}

type Lures = Record<string, Lure>;

interface LureState {
  bait: Bait | null;
  lures: Lures;
  fetchLure: (flag: string, fetchIfData?: boolean) => Promise<void>;
  describe: (flag: string, metadata: LureMetadata) => Promise<void>;
  toggle: (flag: string) => Promise<void>;
  start: () => Promise<void>;
}

export const useLureState = create<LureState>(
  persist<LureState>(
    (set, get) => ({
      bait: null,
      lures: {},
      describe: async (flag, metadata) => {
        const { name } = getFlagParts(flag);
        await api.poke({
          app: 'reel',
          mark: 'reel-describe',
          json: {
            token: name,
            metadata,
          },
        });

        return get().fetchLure(flag);
      },
      toggle: async (flag) => {
        const { name } = getFlagParts(flag);
        const lure = get().lures[flag];
        const enabled = !lure?.enabled;
        if (!enabled) {
          api.poke({
            app: 'reel',
            mark: 'reel-undescribe',
            json: {
              token: getFlagParts(flag).name,
            },
          });
        }

        set(
          produce((draft: LureState) => {
            draft.lures[flag] = {
              ...lure,
              enabled,
            };
          })
        );

        await api.poke({
          app: 'grouper',
          mark: enabled ? 'grouper-enable' : 'grouper-disable',
          json: name,
        });

        return get().fetchLure(flag);
      },
      start: async () => {
        const bait = await api.scry<Bait>({
          app: 'reel',
          path: '/bait',
        });

        set(
          produce((draft: LureState) => {
            draft.bait = bait;
          })
        );
      },
      fetchLure: async (flag) => {
        const { name } = getFlagParts(flag);
        const enabled = await asyncWithDefault(
          () => api.subscribeOnce('grouper', `/group-enabled/${flag}`, 20000),
          undefined
        );
        const url = await asyncWithDefault(
          () => api.subscribeOnce('reel', `/token-link/${flag}`, 20000),
          ''
        );
        const metadata = await asyncWithDefault(
          () =>
            api.scry<LureMetadata>({
              app: 'reel',
              path: `/metadata/${name}`,
            }),
          undefined
        );

        set(
          produce((draft: LureState) => {
            draft.lures[flag] = {
              enabled,
              url,
              metadata,
            };
          })
        );
      },
    }),
    {
      name: createStorageKey('lure'),
      version: storageVersion,
      migrate: clearStorageMigration,
    }
  )
);

const selLure = (flag: string) => (s: LureState) => ({
  lure: s.lures[flag] || { url: '' },
  bait: s.bait,
});
const { shouldLoad, newAttempt, finished } = getPreviewTracker();
export function useLure(flag: string, disableLoading = false) {
  const { bait, lure } = useLureState(selLure(flag));

  useEffect(() => {
    if (!bait || disableLoading || !shouldLoad(flag)) {
      return;
    }

    newAttempt(flag);
    useLureState
      .getState()
      .fetchLure(flag)
      .finally(() => finished(flag));
  }, [bait, flag, disableLoading]);

  const toggle = useCallback(async () => {
    return useLureState.getState().toggle(flag);
  }, [flag]);

  const describe = useCallback(
    (metadata: LureMetadata) => {
      return useLureState.getState().describe(flag, metadata);
    },
    [flag]
  );

  return {
    ...lure,
    supported: bait,
    describe,
    toggle,
  };
}
