import { useQuery } from '@tanstack/react-query';
import produce from 'immer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import create from 'zustand';

import { getCurrentUserId, poke, scry, subscribeOnce } from '../api/urbit';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../logic';
import { DeepLinkMetadata, createDeepLink } from '../logic/branch';
import { asyncWithDefault, getFlagParts, withRetry } from '../logic/utils';
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
    inviteServiceEndpoint: string,
    inviteServiceIsDev: boolean
  ) => Promise<void>;
  describe: (flag: string) => Promise<void>;
  toggle: (flag: string) => Promise<void>;
  start: () => Promise<void>;
}

const lureLogger = createDevLogger('lure', false);

function groupsDescribe(meta: GroupMeta & DeepLinkMetadata) {
  return {
    tag: 'groups-0',
    fields: { ...meta }, // makes typescript happy
  };
}

export const useLureState = create<LureState>((set, get) => ({
  bait: null,
  lures: {},
  describe: async (flag) => {
    const currentUserId = getCurrentUserId();
    const group = await db.getGroup({ id: flag });
    const user = await db.getContact({ id: currentUserId });

    if (!group || !user) {
      lureLogger.trackError('[describe] Error looking up group or user', {
        groupId: flag,
        group,
        user,
      });
    }

    try {
      await poke({
        app: 'reel',
        mark: 'reel-describe',
        json: {
          token: flag,
          metadata: groupsDescribe({
            // legacy keys
            title: group?.title ?? '',
            description: group?.description ?? '',
            cover: group?.coverImage ?? '',
            image: group?.iconImage ?? '',

            // new-style metadata keys
            inviterUserId: currentUserId,
            inviterNickname: user?.nickname ?? '',
            inviterAvatarImage: user?.avatarImage ?? '',
            invitedGroupId: flag,
            invitedGroupTitle: group?.title ?? '',
            invitedGroupDescription: group?.description ?? '',
            invitedGroupIconImageUrl: group?.iconImage ?? '',
          }),
        },
      });
    } catch (e) {
      lureLogger.trackError(AnalyticsEvent.InviteError, {
        context: 'reel describe failed',
        errorMessage: e.message,
        errorStack: e.stack,
      });
    }
  },
  toggle: async (flag) => {
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
      get().describe(flag);
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
    try {
      const bait = await scry<Bait>({
        app: 'reel',
        path: '/bait',
      });

      set(
        produce((draft: LureState) => {
          draft.bait = bait;
        })
      );
    } catch (e) {
      lureLogger.trackEvent(AnalyticsEvent.InviteError, {
        context: 'failed to get bait on start',
        errorMessage: e.message,
        errorStack: e.stack,
      });
    }
  },
  fetchLure: async (flag, inviteServiceEndpoint, inviteServiceIsDev) => {
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
            lureLogger.trackEvent(AnalyticsEvent.InviteError, {
              context: `group-enabled failed`,
              errorMessage: e.message,
              errorStack: e.stack,
            });
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
            lureLogger.trackError(AnalyticsEvent.InviteDebug, {
              context: `id-link failed`,
              errorMessage: e.message,
              errorStack: e.stack,
            });
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
      const name = group?.title || group?.id;
      const title = name ? `Join ${name}` : undefined;
      const description = group?.description ?? undefined;
      const image = group?.coverImage ?? group?.iconImage ?? undefined;
      const metadata: DeepLinkMetadata = {
        $og_title: title,
        $og_description: description,
        $og_image_url: image,
        $twitter_title: title,
        $twitter_description: description,
        $twitter_image_url: image,
        $twitter_card: group?.coverImage
          ? 'summary_large_image'
          : group?.iconImage
            ? 'summary'
            : undefined,
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
        metadata,
      });
      lureLogger.crumb('deepLinkUrl created', deepLinkUrl);
    }

    lureLogger.trackEvent(AnalyticsEvent.InviteDebug, {
      context: 'fetchLure result',
      flag,
      enabled,
      url,
      deepLinkUrl,
    });

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
  inviteServiceEndpoint,
  inviteServiceIsDev,
  disableLoading = false,
}: {
  flag: string;
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
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
      lureLogger.crumb(
        'fetching',
        flag,
        inviteServiceEndpoint,
        inviteServiceIsDev
      );
      await fetchLure(flag, inviteServiceEndpoint, inviteServiceIsDev);
      return true;
    },
    enabled: canCheckForUpdate && uninitialized,
    refetchInterval: 5000,
  });

  const toggle = async () => {
    lureLogger.crumb('toggling', flag);
    return useLureState.getState().toggle(flag);
  };

  const describe = useCallback(() => {
    return useLureState.getState().describe(flag);
  }, [flag]);

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
  inviteServiceEndpoint,
  inviteServiceIsDev,
}: {
  flag: string;
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
}) {
  const [lastLoggedStatus, setLastLoggedStatus] = useState('');
  const { supported, fetched, enabled, url, deepLinkUrl, toggle, describe } =
    useLure({
      flag,
      inviteServiceEndpoint,
      inviteServiceIsDev,
    });
  const { good, checked } = useLureLinkChecked(url, !!enabled);

  const inviteInfo = useMemo(
    () => ({
      flag,
      supported,
      fetched,
      enabled,
      checked,
      good,
      url,
      deepLinkUrl,
    }),
    [flag, supported, fetched, enabled, checked, good, url, deepLinkUrl]
  );

  lureLogger.crumb('useLureLinkStatus', inviteInfo);

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
      return 'error';
    }

    return 'ready';
  }, [supported, fetched, enabled, url, checked, deepLinkUrl, good, flag]);

  // prevent over zealous logging
  const statusKey = useMemo(() => {
    return `${status}-${fetched}-${checked}`;
  }, [status, fetched, checked]);

  if (statusKey !== lastLoggedStatus) {
    if (status === 'error') {
      lureLogger.trackEvent(AnalyticsEvent.InviteError, {
        context: 'useLureLinkStatus has error status',
        inviteStatus: status,
        inviteInfo,
      });
    } else {
      lureLogger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'useLureLinkStatus log',
        inviteStatus: status,
        inviteInfo,
      });
    }
    setLastLoggedStatus(statusKey);
  }

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
