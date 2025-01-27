import { useQuery } from '@tanstack/react-query';
import { Contact } from '@tloncorp/shared/urbit';
import { GroupMeta } from '@tloncorp/shared/urbit/groups';
import produce from 'immer';
import { useMemo } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import api from '@/api';
import { DeepLinkMetadata, createDeepLink } from '@/logic/branch';
import {
  asyncWithDefault,
  clearStorageMigration,
  createDevLogger,
  createStorageKey,
  getFlagParts,
  getPrivacyFromGroup,
  storageVersion,
} from '@/logic/utils';

import { useContact } from '../contact';
import { useAmAdmin, useGroup } from '../groups';

interface LureMetadata {
  tag: string;
  fields: Record<string, string | undefined>;
}

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
  fetchLure: (flag: string, linkMetadata: DeepLinkMetadata) => Promise<void>;
  createLure: (flag: string, linkMetadata: DeepLinkMetadata) => Promise<void>;
  start: () => Promise<void>;
}

const lureLogger = createDevLogger('lure', true);

const LURE_REQUEST_TIMEOUT = 10 * 1000;

function groupsDescribe(meta: DeepLinkMetadata) {
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
      createLure: async (flag, linkMetadata) => {
        const { name } = getFlagParts(flag);
        try {
          const describeMeta = groupsDescribe(linkMetadata);
          await api.poke({
            app: 'reel',
            mark: 'reel-describe',
            json: {
              token: flag,
              metadata: describeMeta,
            },
          });
          lureLogger.log(`createLure: described`, flag);
        } catch (err) {
          lureLogger.error('createLure: failed to describe', err);
          return;
        }

        try {
          await api.poke({
            app: 'grouper',
            mark: 'grouper-enable',
            json: name,
          });
          lureLogger.log(`createLure: enabled`, flag);
        } catch (err) {
          lureLogger.error('createLure: failed to describe', err);
        }
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
      fetchLure: async (flag, linkMetadata) => {
        const { lures, createLure } = get();
        const prevLure = lures[flag];
        lureLogger.log('fetching', flag, 'prevLure', prevLure);
        lureLogger.log(performance.now(), 'fetching url with scry', flag);
        // url (includes the token as last element of the path)
        const localUrl = await api
          .scry<string>({
            app: 'reel',
            path: `/v1/id-url/${flag}`,
          })
          .then((u) => {
            lureLogger.log(performance.now(), 'url fetched', u, flag);
            return u;
          })
          .catch((e) => {
            lureLogger.error('Invite Debug', {
              context: `id-link failed`,
              errorMessage: e.message,
              errorStack: e.stack,
            });
            return prevLure?.url;
          });

        let url = localUrl;
        if (!url || checkOldLureToken(url)) {
          // start the process of creating the lure
          createLure(flag, linkMetadata);

          // listen for the result
          url = await asyncWithDefault<string | undefined>(async () => {
            lureLogger.log(performance.now(), 'fetching url with sub', flag);
            return api
              .subscribeOnce<string>(
                'reel',
                `/v1/id-link/${flag}`,
                LURE_REQUEST_TIMEOUT
              )
              .then((u) => {
                lureLogger.log(performance.now(), 'url fetched', u, flag);
                return u;
              })
              .catch((e) => {
                lureLogger.error('Invite Debug', {
                  context: `id-link failed`,
                  errorMessage: e.message,
                  errorStack: e.stack,
                });
                return prevLure?.url;
              });
          }, prevLure?.url);
        }

        lureLogger.log('fetched', { flag, url });

        let deepLinkUrl: string | undefined;
        if (checkLureToken(url)) {
          deepLinkUrl = await createDeepLink(url, 'lure', flag, linkMetadata);
          lureLogger.log('deepLinkUrl created', deepLinkUrl);
        }

        lureLogger.error('Invite Debug', {
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
    }),
    {
      name: createStorageKey('lure'),
      version: storageVersion,
      migrate: clearStorageMigration,
    }
  )
);

function getLureMetadata(flag: string, meta: GroupMeta, profile: Contact) {
  const iconIsColor = meta.image ? meta.image.startsWith('#') : false;
  return {
    inviterUserId: window.our,
    inviterNickname: profile.nickname || undefined,
    inviterAvatarImage: profile.avatar || undefined,
    invitedGroupId: flag,
    invitedGroupTitle: meta.title || undefined,
    invitedGroupDescription: meta.description || undefined,
    invitedGroupIconImageUrl:
      meta.image && !iconIsColor ? meta.image : undefined,
    invitedGroupiconImageColor:
      meta.image && iconIsColor ? meta.image : undefined,
  };
}

const emptyMeta = {
  title: '',
  description: '',
  image: '',
  cover: '',
};

const selLure = (flag: string) => (s: LureState) => ({
  lure: s.lures[flag] || { fetched: false, url: '' },
  bait: s.bait,
});

export function useLure(flag: string, disableLoading = false) {
  const { bait, lure } = useLureState(selLure(flag));
  const group = useGroup(flag);
  const contact = useContact(window.our);
  const linkMetadata = useMemo(() => {
    return getLureMetadata(flag, group?.meta || emptyMeta, contact);
  }, [flag, group?.meta, contact]);
  const isAdmin = useAmAdmin(flag);
  const privacy = useMemo(
    () => (group ? getPrivacyFromGroup(group) : undefined),
    [group]
  );

  const havePermission = Boolean(privacy === 'public' || isAdmin);

  const fetchLure = useLureState((state) => state.fetchLure);

  const canCheckForUpdate = useMemo(() => {
    const uninitialized = Boolean(
      !lure.fetched &&
        (!lure.url || !checkLureToken(lure.url) || !lure.deepLinkUrl) &&
        group &&
        havePermission
    );
    return Boolean(bait && !disableLoading && uninitialized);
  }, [
    lure.fetched,
    lure.url,
    lure.deepLinkUrl,
    group,
    havePermission,
    bait,
    disableLoading,
  ]);

  lureLogger.log('lure fetcher', canCheckForUpdate);
  useQuery({
    queryKey: ['lureFetcher', flag],
    queryFn: async () => {
      console.log('fetching', flag);
      await fetchLure(flag, linkMetadata);
      return true;
    },
    enabled: canCheckForUpdate,
    refetchInterval: 5000,
  });

  lureLogger.log('useLure', flag, bait, lure);

  const { fetched, url, deepLinkUrl } = lure;

  const status = useMemo(() => {
    if (!bait) {
      return 'unsupported';
    }

    if (!havePermission) {
      return 'disabled';
    }

    if ((url && checkOldLureToken(url)) || (fetched && !url)) {
      return 'stale';
    }

    if (!url || !checkLureToken(url) || !fetched || !deepLinkUrl) {
      console.log('loading', fetched, url, deepLinkUrl);
      return 'loading';
    }

    return 'ready';
  }, [bait, havePermission, url, fetched, deepLinkUrl]);

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
