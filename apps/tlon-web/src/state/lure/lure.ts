import api from '@/api';
import { createDeepLink } from '@/logic/branch';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import {
  asyncWithDefault,
  clearStorageMigration,
  createDevLogger,
  createStorageKey,
  getFlagParts,
  storageVersion,
} from '@/logic/utils';
import { GroupMeta } from '@/types/groups';
import { useQuery } from '@tanstack/react-query';
import produce from 'immer';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import { useLocalState } from '../local';

interface LureMetadata {
  tag: string;
  fields: Record<string, string | undefined>;
}

interface Lure {
  fetched: boolean;
  url: string;
  deepLinkUrl?: string;
  enabled?: boolean;
  enableAcked?: boolean;
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
  toggle: (flag: string, metadata: GroupMeta) => Promise<void>;
  start: () => Promise<void>;
}

const lureLogger = createDevLogger(
  'lure',
  useLocalState.getState().showDevTools
);

const LURE_REQUEST_TIMEOUT = 10 * 1000;

function groupsDescribe(meta: GroupMeta) {
  return {
    tag: 'groups-0',
    fields: { ...meta }, // makes typescript happy
  };
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
      toggle: async (flag, meta) => {
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
        } else {
          get().describe(flag, groupsDescribe(meta));
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
        const prevLure = get().lures[flag];
        const [enabled, url, metadata, outstandingPoke] = await Promise.all([
          // enabled
          asyncWithDefault(() => {
            lureLogger.log(performance.now(), 'fetching enabled', flag);
            return api
              .subscribeOnce<boolean>(
                'grouper',
                `/group-enabled/${flag}`,
                LURE_REQUEST_TIMEOUT
              )
              .then((en) => {
                lureLogger.log(performance.now(), 'enabled fetched', flag);

                return en;
              });
          }, prevLure?.enabled),
          // url
          asyncWithDefault(() => {
            lureLogger.log(performance.now(), 'fetching url', flag);
            return api
              .subscribeOnce<string>(
                'reel',
                `/token-link/${flag}`,
                LURE_REQUEST_TIMEOUT
              )
              .then((u) => {
                lureLogger.log(performance.now(), 'url fetched', flag);
                return u;
              });
          }, prevLure?.url),
          // metadata
          asyncWithDefault(
            () =>
              api.scry<LureMetadata>({
                app: 'reel',
                path: `/metadata/${name}`,
              }),
            prevLure?.metadata
          ),
          // outstandingPoke
          asyncWithDefault(
            () =>
              api.scry<boolean>({
                app: 'reel',
                path: `/outstanding-poke/${flag}`,
              }),
            false
          ),
        ]);

        let deepLinkUrl: string | undefined;
        if (enabled && url) {
          deepLinkUrl = await createDeepLink(url, 'lure', flag);
        }

        set(
          produce((draft: LureState) => {
            draft.lures[flag] = {
              fetched: true,
              enabled,
              enableAcked: !outstandingPoke,
              url,
              deepLinkUrl,
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
  lure: s.lures[flag] || { fetched: false, url: '' },
  bait: s.bait,
});
const { shouldLoad, newAttempt, finished } = getPreviewTracker(30 * 1000);
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

  const toggle = useCallback(
    (meta: GroupMeta) => async () => {
      return useLureState.getState().toggle(flag, meta);
    },
    [flag]
  );

  const describe = useCallback(
    (meta: GroupMeta) => {
      return useLureState.getState().describe(flag, groupsDescribe(meta));
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

export function useLureLinkChecked(flag: string, enabled: boolean) {
  const prevData = useRef<boolean | undefined>(false);
  const { data, ...query } = useQuery(
    ['lure-check', flag],
    () =>
      asyncWithDefault(
        () =>
          api.subscribeOnce<boolean>('grouper', `/check-link/${flag}`, 4500),
        prevData.current ?? false
      ),
    {
      enabled,
      refetchInterval: 5000,
    }
  );

  prevData.current = data;

  return {
    ...query,
    good: data,
    checked: query.isFetched && !query.isLoading,
  };
}

export function useLureLinkStatus(flag: string) {
  const { supported, fetched, enabled, enableAcked, url, deepLinkUrl, toggle } =
    useLure(flag);
  const { good, checked } = useLureLinkChecked(flag, !!enabled);

  const status = useMemo(() => {
    if (!supported) {
      return 'unsupported';
    }

    if (fetched && !enabled) {
      return 'disabled';
    }

    if (!url || !fetched || !checked) {
      return 'loading';
    }

    if (checked && !good) {
      return 'error';
    }

    return 'ready';
  }, [supported, fetched, enabled, url, good, checked]);

  return { status, shareUrl: deepLinkUrl ?? url, toggle };
}
