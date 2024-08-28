import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import produce from 'immer';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import { poke, scry, subscribeOnce } from '../api/urbit';
import { createDevLogger } from '../debug';
import { createDeepLink } from '../logic/branch';
import { getPreviewTracker } from '../logic/subscriptionTracking';
import {
  asyncWithDefault,
  clearStorageMigration,
  getFlagParts,
} from '../logic/utils';
import { GroupMeta } from '../urbit/groups';

interface LureMetadata {
  tag: string;
  fields: Record<string, string | undefined>;
}

const LURE_REQUEST_TIMEOUT = 10 * 1000;

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
  fetchLure: (
    flag: string,
    branchDomain: string,
    branchKey: string,
    fetchIfData?: boolean
  ) => Promise<void>;
  describe: (
    flag: string,
    metadata: LureMetadata,
    branchDomain: string,
    branchKey: string
  ) => Promise<void>;
  toggle: (
    flag: string,
    metadata: GroupMeta,
    branchDomain: string,
    branchKey: string
  ) => Promise<void>;
  start: () => Promise<void>;
}

const lureLogger = createDevLogger('lure', true);

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
      describe: async (flag, metadata, branchDomain, branchKey) => {
        const { name } = getFlagParts(flag);
        await poke({
          app: 'reel',
          mark: 'reel-describe',
          json: {
            token: name,
            metadata,
          },
        });

        return get().fetchLure(flag, branchDomain, branchKey);
      },
      toggle: async (flag, meta, branchDomain, branchKey) => {
        const { name } = getFlagParts(flag);
        const lure = get().lures[flag];
        const enabled = !lure?.enabled;
        if (!enabled) {
          lureLogger.log('not enabled, poking reel-undescribe', flag);
          await poke({
            app: 'reel',
            mark: 'reel-undescribe',
            json: {
              token: getFlagParts(flag).name,
            },
          });
        } else {
          get().describe(flag, groupsDescribe(meta), branchDomain, branchKey);
        }

        set(
          produce((draft: LureState) => {
            draft.lures[flag] = {
              ...lure,
              enabled,
            };
          })
        );

        await poke({
          app: 'grouper',
          mark: enabled ? 'grouper-enable' : 'grouper-disable',
          json: name,
        });

        return get().fetchLure(flag, branchDomain, branchKey);
      },
      start: async () => {
        const bait = await scry<Bait>({
          app: 'reel',
          path: '/bait',
        });

        set(
          produce((draft: LureState) => {
            draft.bait = bait;
          })
        );
      },
      fetchLure: async (flag, branchDomain, branchKey) => {
        const { name } = getFlagParts(flag);
        const prevLure = get().lures[flag];
        lureLogger.log('fetching', flag, 'prevLure', prevLure);
        const [enabled, url, metadata, outstandingPoke] = await Promise.all([
          // enabled
          asyncWithDefault(async () => {
            lureLogger.log(performance.now(), 'fetching enabled', flag);
            return subscribeOnce<boolean>(
              {
                app: 'grouper',
                path: `/group-enabled/${flag}`,
              },
              LURE_REQUEST_TIMEOUT
            ).then((en) => {
              lureLogger.log(performance.now(), 'enabled fetched', flag);

              return en;
            });
          }, prevLure?.enabled),
          // url
          asyncWithDefault(async () => {
            lureLogger.log(performance.now(), 'fetching url', flag);
            return subscribeOnce<string>(
              {
                app: 'reel',
                path: `/token-link/${flag}`,
              },
              LURE_REQUEST_TIMEOUT
            ).then((u) => {
              lureLogger.log(performance.now(), 'url fetched', u, flag);
              return u;
            });
          }, prevLure?.url),
          // metadata
          asyncWithDefault(
            async () =>
              scry<LureMetadata>({
                app: 'reel',
                path: `/metadata/${name}`,
              }),
            prevLure?.metadata
          ),
          // outstandingPoke
          asyncWithDefault(
            async () =>
              scry<boolean>({
                app: 'reel',
                path: `/outstanding-poke/${flag}`,
              }),
            false
          ),
        ]);

        lureLogger.log(
          'fetched',
          flag,
          enabled,
          url,
          metadata,
          outstandingPoke
        );

        let deepLinkUrl: string | undefined;
        lureLogger.log('enabled', enabled);
        if (enabled && url) {
          deepLinkUrl = await createDeepLink(
            url,
            'lure',
            flag,
            branchDomain,
            branchKey
          );
          lureLogger.log('deepLinkUrl created', deepLinkUrl);
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
      name: 'lure',
      version: 1,
      migrate: clearStorageMigration,
      getStorage: () => AsyncStorage,
    }
  )
);

const selLure = (flag: string) => (s: LureState) => ({
  lure: s.lures[flag] || { fetched: false, url: '' },
  bait: s.bait,
});
const { shouldLoad, newAttempt, finished } = getPreviewTracker(30 * 1000);
export function useLure({
  flag,
  branchDomain,
  branchKey,
  disableLoading = false,
}: {
  flag: string;
  branchDomain: string;
  branchKey: string;
  disableLoading?: boolean;
}) {
  const { bait, lure } = useLureState(selLure(flag));

  lureLogger.log('bait', bait);
  lureLogger.log('lure', lure);

  useEffect(() => {
    if (!bait || disableLoading || !shouldLoad(flag)) {
      lureLogger.log('skipping', flag, bait, disableLoading, !shouldLoad(flag));
      return;
    }

    lureLogger.log('fetching', flag, branchDomain, branchKey);

    newAttempt(flag);
    useLureState
      .getState()
      .fetchLure(flag, branchDomain, branchKey)
      .finally(() => finished(flag));
  }, [bait, flag, branchDomain, branchKey, disableLoading]);

  const toggle = async (meta: GroupMeta) => {
    lureLogger.log('toggling', flag, meta, branchDomain, branchKey);
    return useLureState.getState().toggle(flag, meta, branchDomain, branchKey);
  };

  const describe = useCallback(
    (meta: GroupMeta) => {
      return useLureState
        .getState()
        .describe(flag, groupsDescribe(meta), branchDomain, branchKey);
    },
    [flag, branchDomain, branchKey]
  );

  lureLogger.log('useLure', flag, bait, lure, describe);

  return {
    ...lure,
    supported: bait,
    describe,
    toggle,
  };
}

export function useLureLinkChecked(flag: string, enabled: boolean) {
  const prevData = useRef<boolean | undefined>(false);
  const { data, ...query } = useQuery({
    queryKey: ['lure-check', flag],
    queryFn: async () =>
      subscribeOnce<boolean>(
        { app: 'grouper', path: `/check-link/${flag}` },
        4500
      ),
    enabled,
    refetchInterval: 5000,
  });

  prevData.current = data;

  lureLogger.log('useLureLinkChecked', flag, data);

  return {
    ...query,
    good: data,
    checked: query.isFetched && !query.isLoading,
  };
}

export function useLureLinkStatus({
  flag,
  branchDomain,
  branchKey,
}: {
  flag: string;
  branchDomain: string;
  branchKey: string;
}) {
  const { supported, fetched, enabled, enableAcked, url, deepLinkUrl, toggle } =
    useLure({
      flag,
      branchDomain,
      branchKey,
    });
  const { good, checked } = useLureLinkChecked(flag, !!enabled);

  lureLogger.log('useLureLinkStatus', {
    flag,
    supported,
    fetched,
    enabled,
    checked,
    good,
    url,
    deepLinkUrl,
  });

  const status = useMemo(() => {
    if (!supported) {
      return 'unsupported';
    }

    if (fetched && !enabled) {
      return 'disabled';
    }

    if (!url || !fetched || !checked) {
      lureLogger.log('loading', fetched, checked, url);
      return 'loading';
    }

    if (checked && !good) {
      return 'error';
    }

    return 'ready';
  }, [supported, fetched, enabled, url, good, checked]);

  lureLogger.log('url', url, 'deepLinkUrl', deepLinkUrl, 'status', status);

  return { status, shareUrl: deepLinkUrl ?? url, toggle };
}
