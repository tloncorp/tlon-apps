import { useQuery } from '@tanstack/react-query';
import produce from 'immer';
import { useEffect, useMemo, useState } from 'react';
import create from 'zustand';

import { getCurrentUserId, scry, subscribeOnce } from '../api/urbit';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import { DeepLinkMetadata, createDeepLink } from '../logic/branch';
import { asyncWithDefault } from '../logic/utils';
import { createGroupInviteLink } from './inviteActions';

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
  start: () => Promise<void>;
}

const lureLogger = createDevLogger('lure', false);

export const useLureState = create<LureState>((set, get) => ({
  bait: null,
  lures: {},
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
        error: e,
        context: 'failed to get bait on start',
      });
    }
  },
  fetchLure: async (flag) => {
    const { lures } = get();
    const prevLure = lures[flag];
    lureLogger.crumb('fetching', flag, 'prevLure', prevLure);
    lureLogger.crumb(performance.now(), 'fetching url with scry', flag);
    // url (includes the token as last element of the path)
    const localUrl = await scry<string>({
      app: 'reel',
      path: `/v1/id-url/${flag}`,
    })
      .then((u) => {
        lureLogger.crumb(performance.now(), 'url fetched', u, flag);
        return u;
      })
      .catch((e) => {
        lureLogger.trackEvent(AnalyticsEvent.InviteDebug, {
          error: e,
          context: `id-link failed`,
        });
        return prevLure?.url;
      });

    let url = localUrl;
    if (!url || checkOldLureToken(url)) {
      // start the process of creating the lure
      await createGroupInviteLink(flag);
      // listen for the result
      url = await asyncWithDefault<string | undefined>(async () => {
        lureLogger.crumb(performance.now(), 'fetching url with sub', flag);
        return subscribeOnce<string>(
          { app: 'reel', path: `/v1/id-link/${flag}` },
          LURE_REQUEST_TIMEOUT,
          undefined,
          { tag: 'lureFetcher' }
        )
          .then((u) => {
            lureLogger.crumb(performance.now(), 'url fetched', u, flag);
            return u;
          })
          .catch((e) => {
            lureLogger.trackEvent(AnalyticsEvent.InviteDebug, {
              error: e,
              context: `id-link failed`,
            });
            return prevLure?.url;
          });
      }, prevLure?.url);
    }

    lureLogger.crumb('fetched', { flag, url });

    let deepLinkUrl: string | undefined;
    if (checkLureToken(url)) {
      const currentUserId = getCurrentUserId();
      const group = await db.getGroup({ id: flag });
      const user = await db.getContact({ id: currentUserId });
      const metadata: DeepLinkMetadata = {
        inviteType: 'group',
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
      url,
      deepLinkUrl,
    });

    set(
      produce((draft: LureState) => {
        draft.lures[flag] = {
          fetched: true,
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
  const [lastLoggedStatus, setLastLoggedStatus] = useState('');
  const fetchLure = useLureState((state) => state.fetchLure);
  const { bait, lure } = useLureState(selLure(flag));

  const canCheckForUpdate = useMemo(() => {
    const uninitialized = Boolean(
      !lure.url || !checkLureToken(lure.url) || !lure.deepLinkUrl
    );
    return Boolean(bait && !disableLoading && uninitialized);
  }, [bait, lure, disableLoading]);

  lureLogger.crumb('lure fetcher', canCheckForUpdate);
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
    enabled: canCheckForUpdate,
    refetchInterval: 5000,
  });

  lureLogger.crumb('useLure', flag, bait, lure);

  const { fetched, url, deepLinkUrl } = lure;

  const status = useMemo(() => {
    if (!bait) {
      return 'unsupported';
    }

    if ((url && checkOldLureToken(url)) || (fetched && !url)) {
      return 'stale';
    }

    if (!url || !checkLureToken(url) || !fetched || !deepLinkUrl) {
      lureLogger.crumb('loading', fetched, url, deepLinkUrl);
      return 'loading';
    }

    return 'ready';
  }, [bait, fetched, url, deepLinkUrl]);

  // prevent over zealous logging
  const statusKey = useMemo(() => {
    return `${status}-${lure?.fetched}`;
  }, [status, lure]);

  const inviteInfo = useMemo(
    () => ({
      flag,
      supported: Boolean(bait),
      fetched,
      url,
      deepLinkUrl,
    }),
    [flag, bait, fetched, url, deepLinkUrl]
  );

  useEffect(() => {
    if (statusKey !== lastLoggedStatus) {
      lureLogger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'useLure status log',
        inviteStatus: status,
        inviteInfo,
      });
      setLastLoggedStatus(statusKey);
    }
  }, [statusKey, inviteInfo, lastLoggedStatus, status]);

  return {
    ...lure,
    status,
    shareUrl: deepLinkUrl,
    supported: bait,
  };
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
