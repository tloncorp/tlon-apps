import { useQuery } from '@tanstack/react-query';
import produce from 'immer';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import create from 'zustand';

import { getCurrentUserId, poke, scry, subscribeOnce } from '../api/urbit';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { DeepLinkMetadata, createDeepLink } from '../logic/branch';
import { asyncWithDefault, getFlagParts } from '../logic/utils';
import { stringToTa } from '../urbit';
import { GroupMeta } from '../urbit/groups';

interface LureMetadata {
  tag: string;
  fields: Record<string, string | undefined>;
}

const LURE_REQUEST_TIMEOUT = 3 * 1000;

interface Lure {
  fetched: boolean;
  url?: string;
  deepLinkUrl?: string;
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
  fetchLure: (
    flag: string,
    branchDomain: string,
    branchKey: string
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

export const useLureState = create<LureState>((set, get) => ({
  bait: null,
  lures: {},
  describe: async (flag, metadata, branchDomain, branchKey) => {
    await poke({
      app: 'reel',
      mark: 'reel-describe',
      json: {
        token: flag,
        metadata,
      },
    });
  },
  toggle: async (flag, meta, branchDomain, branchKey) => {
    const { name } = getFlagParts(flag);
    const lure = get().lures[flag];
    const enabled = !lure?.enabled;
    if (!enabled) {
      lureLogger.crumb('not enabled, poking reel-undescribe', flag);
      await poke({
        app: 'reel',
        mark: 'reel-undescribe',
        json: {
          token: flag,
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
    lureLogger.crumb('fetching', flag, 'prevLure', prevLure);
    const [enabled, url] = await Promise.all([
      // enabled
      asyncWithDefault(async () => {
        lureLogger.crumb(performance.now(), 'fetching enabled', flag);
        return subscribeOnce<boolean>(
          {
            app: 'grouper',
            path: `/group-enabled/${flag}`,
          },
          LURE_REQUEST_TIMEOUT
        )
          .then((en) => {
            lureLogger.crumb(performance.now(), 'enabled fetched', flag);

            return en;
          })
          .catch((e) => {
            lureLogger.error(`group-enabled failed`, e);
            return prevLure?.enabled;
          });
      }, prevLure?.enabled),
      // url (includes the token as last element of the path)
      asyncWithDefault<string | undefined>(async () => {
        lureLogger.crumb(performance.now(), 'fetching url', flag);
        return subscribeOnce<string>(
          { app: 'reel', path: `/v1/id-link/${flag}` },
          LURE_REQUEST_TIMEOUT
        )
          .then((u) => {
            lureLogger.crumb(performance.now(), 'url fetched', u, flag);
            return u;
          })
          .catch((e) => {
            lureLogger.error(`id-link failed`, e);
            return prevLure?.url;
          });
      }, prevLure?.url),
    ]);

    lureLogger.crumb('fetched', { flag, enabled, url });

    let deepLinkUrl: string | undefined;
    lureLogger.crumb('enabled', enabled);
    if (enabled && checkLureToken(url)) {
      const currentUserId = getCurrentUserId();
      const group = await db.getGroup({ id: flag });
      const user = await db.getContact({ id: currentUserId });
      const metadata: DeepLinkMetadata = {
        inviterUserId: currentUserId,
        inviterNickname: user?.nickname ?? undefined,
        inviterAvatarImage: user?.avatarImage ?? undefined,
        invitedGroupId: flag,
        invitedGroupTitle: group?.title ?? undefined,
        invitedGroupDescription: group?.description ?? undefined,
        invitedGroupIconImageUrl: group?.iconImage ?? undefined,
        invitedGroupiconImageColor: group?.iconImageColor ?? undefined,
      };

      deepLinkUrl = await createDeepLink({
        fallbackUrl: url,
        type: 'lure',
        path: flag,
        branchDomain,
        branchKey,
        metadata,
      });
      lureLogger.crumb('deepLinkUrl created', deepLinkUrl);
    }

    set(
      produce((draft: LureState) => {
        draft.lures[flag] = {
          fetched: true,
          enabled,
          url,
          deepLinkUrl,
        };
      })
    );
  },
}));

const selLure = (flag: string) => (s: LureState) => ({
  lure: s.lures[flag] || { fetched: false, url: '' },
  bait: s.bait,
});

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
  const fetchLure = useLureState((state) => state.fetchLure);
  const { bait, lure } = useLureState(selLure(flag));

  lureLogger.crumb('bait', bait);
  lureLogger.crumb('lure', lure);

  const canCheckForUpdate = useMemo(() => {
    return Boolean(bait && !disableLoading);
  }, [bait, disableLoading]);

  const uninitialized = useMemo(() => {
    return Boolean(
      (lure.enabled || !lure.fetched) &&
        (!lure.url || !checkLureToken(lure.url) || !lure.deepLinkUrl)
    );
  }, [lure]);

  lureLogger.crumb('lure fetcher', { canCheckForUpdate, uninitialized });
  useQuery({
    queryKey: ['lureFetcher', flag],
    queryFn: async () => {
      lureLogger.crumb('fetching', flag, branchDomain, branchKey);
      await fetchLure(flag, branchDomain, branchKey);
      return true;
    },
    enabled: canCheckForUpdate && uninitialized,
    refetchInterval: 5000,
  });

  const toggle = async (meta: GroupMeta) => {
    lureLogger.crumb('toggling', flag, meta, branchDomain, branchKey);
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

  lureLogger.crumb('useLure', flag, bait, lure, describe);

  return {
    ...lure,
    supported: bait,
    describe,
    toggle,
  };
}

export function useLureLinkChecked(url: string | undefined, enabled: boolean) {
  const prevData = useRef<boolean | undefined>(false);
  const pathEncodedUrl = stringToTa(url ?? '');
  const { data, ...query } = useQuery({
    queryKey: ['lure-check', url],
    queryFn: async () =>
      subscribeOnce<boolean>(
        { app: 'grouper', path: `/v1/check-link/${pathEncodedUrl}` },
        4500
      ),
    enabled: enabled && Boolean(url),
    refetchInterval: 5000,
  });

  prevData.current = data;

  lureLogger.crumb('useLureLinkChecked', url, data);

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
  const { supported, fetched, enabled, url, deepLinkUrl, toggle, describe } =
    useLure({
      flag,
      branchDomain,
      branchKey,
    });
  const { good, checked } = useLureLinkChecked(url, !!enabled);

  lureLogger.crumb('useLureLinkStatus', {
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

    if ((url && checkOldLureToken(url)) || (fetched && !url)) {
      return 'stale';
    }

    if (!url || !checkLureToken(url) || !fetched || !checked || !deepLinkUrl) {
      lureLogger.crumb('loading', fetched, checked, url, deepLinkUrl);
      return 'loading';
    }

    if (checked && !good) {
      lureLogger.trackError('useLureLinkStatus has error status', {
        flag,
        enabled,
        checked,
        good,
        url,
        deepLinkUrl,
      });
      return 'error';
    }

    return 'ready';
  }, [supported, fetched, enabled, url, checked, deepLinkUrl, good, flag]);

  lureLogger.crumb('url', url, 'deepLinkUrl', deepLinkUrl, 'status', status);

  return { status, shareUrl: deepLinkUrl, toggle, describe };
}

// hack: we get an intermediate state while generating lure links where
// the returned token will be incorrect. Once it's a @uv we know
// we have the right one
function checkLureToken(url: string | undefined) {
  if (!url) return false;
  const token = url.split('/').pop();
  return token && token.startsWith('0v');
}

function checkOldLureToken(url: string | undefined) {
  if (!url) return false;
  const parts = url.split('/');
  const token = parts.pop();
  const ship = parts.pop();
  return ship && token && ship.startsWith('~');
}
