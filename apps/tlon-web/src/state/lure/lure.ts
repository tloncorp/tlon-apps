import { useQuery } from '@tanstack/react-query';
import { GroupMeta } from '@tloncorp/shared/dist/urbit/groups';
import produce from 'immer';
import { Contact } from 'packages/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import api from '@/api';
import { DeepLinkMetadata, createDeepLink } from '@/logic/branch';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import {
  asyncWithDefault,
  clearStorageMigration,
  createDevLogger,
  createStorageKey,
  getFlagParts,
  storageVersion,
  stringToTa,
} from '@/logic/utils';

import { useContact } from '../contact';
import { useGroup } from '../groups';
import { useLocalState } from '../local';

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
  describe: (
    flag: string,
    lureMetadata: LureMetadata,
    linkMetadata: DeepLinkMetadata
  ) => Promise<void>;
  toggle: (
    flag: string,
    lureMetadata: LureMetadata,
    linkMetadata: DeepLinkMetadata
  ) => Promise<void>;
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
      describe: async (flag, lureMetadata, linkMetadata) => {
        await api.poke({
          app: 'reel',
          mark: 'reel-describe',
          json: {
            token: flag,
            metadata: lureMetadata,
          },
        });

        return get().fetchLure(flag, linkMetadata);
      },
      toggle: async (flag, lureMetadata, linkMetadata) => {
        const { name } = getFlagParts(flag);
        const lure = get().lures[flag];
        const enabled = !lure?.enabled;
        if (!enabled) {
          api.poke({
            app: 'reel',
            mark: 'reel-undescribe',
            json: {
              token: flag,
            },
          });
        } else {
          get().describe(flag, lureMetadata, linkMetadata);
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

        return get().fetchLure(flag, linkMetadata);
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
        const prevLure = get().lures[flag];
        const [enabled, url, metadata] = await Promise.all([
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
                lureLogger.log(performance.now(), 'enabled fetched', en, flag);

                return en;
              });
          }, prevLure?.enabled),
          // url
          asyncWithDefault(() => {
            lureLogger.log(performance.now(), 'fetching url', flag);
            return api
              .subscribeOnce<string>('reel', `/v1/id-link/${flag}`, 4500)
              .then((u) => {
                lureLogger.log(performance.now(), 'url fetched', u, flag);
                return u;
              })
              .catch((e) => {
                lureLogger.error(
                  performance.now(),
                  'url fetch timeout',
                  e,
                  flag
                );
                return undefined;
              });
          }, prevLure?.url) as Promise<string | undefined>,
          // metadata
          asyncWithDefault(
            () =>
              api.scry<LureMetadata>({
                app: 'reel',
                path: `/v1/metadata/${flag}`,
              }),
            prevLure?.metadata
          ),
        ]);

        let deepLinkUrl: string | undefined;
        if (enabled && url) {
          deepLinkUrl = await createDeepLink(url, 'lure', flag, linkMetadata);
        }

        set(
          produce((draft: LureState) => {
            draft.lures[flag] = {
              fetched: true,
              enabled,
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

function getLureMetadata(flag: string, meta: GroupMeta, profile: Contact) {
  const title = `Join ${meta.title || flag}`;
  const description = meta.description || '';
  const image = meta.cover || meta.image || undefined;
  const iconIsColor = meta.image ? meta.image.startsWith('#') : false;

  return {
    $og_title: title,
    $og_description: description,
    $og_image_url: image,
    $twitter_title: title,
    $twitter_description: description,
    $twitter_image_url: image,
    $twitter_card: meta.cover
      ? 'summary_large_image'
      : meta.image
        ? 'summary'
        : undefined,
    inviterUserId: window.our,
    inviterNickname: profile.nickname || undefined,
    inviterAvatarImage: profile.avatar || undefined,
    invitedGroupId: flag,
    invitedGroupTitle: title,
    invitedGroupDescription: title,
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
const { shouldLoad, newAttempt, finished } = getPreviewTracker(30 * 1000);
export function useLure(flag: string, disableLoading = false) {
  const { bait, lure } = useLureState(selLure(flag));
  const group = useGroup(flag);
  const contact = useContact(window.our);
  const linkMetadata = useMemo(() => {
    return getLureMetadata(flag, group?.meta || emptyMeta, contact);
  }, [group, contact]);

  useEffect(() => {
    if (!bait || disableLoading || !shouldLoad(flag) || !group) {
      return;
    }

    newAttempt(flag);
    useLureState
      .getState()
      .fetchLure(flag, linkMetadata)
      .finally(() => finished(flag));
  }, [bait, group, linkMetadata, flag, disableLoading]);

  const toggle = useCallback(
    (meta: GroupMeta) => async () => {
      return useLureState
        .getState()
        .toggle(flag, groupsDescribe(meta), linkMetadata);
    },
    [flag, linkMetadata]
  );

  const describe = useCallback(
    (meta: GroupMeta) => {
      return useLureState
        .getState()
        .describe(flag, groupsDescribe(meta), linkMetadata);
    },
    [flag, linkMetadata]
  );

  useEffect(() => {
    if (!group?.meta) {
      return;
    }

    if (lure.enabled && !lure.url) {
      describe(group.meta);
    }

    if (lure.enabled && lure.url && checkOldLureToken(lure.url)) {
      describe(group.meta);
    }
  }, [group]);

  return {
    ...lure,
    supported: bait,
    describe,
    toggle,
  };
}

export function useLureLinkChecked(url: string | undefined, enabled: boolean) {
  const prevData = useRef<boolean | undefined>(false);
  const pathEncodedUrl = stringToTa(url || '');
  const { data, ...query } = useQuery(
    ['lure-check', url],
    () =>
      asyncWithDefault(
        () =>
          api.subscribeOnce<boolean>(
            'grouper',
            `/v1/check-link/${pathEncodedUrl}`,
            4500
          ),
        prevData.current ?? false
      ),
    {
      enabled: enabled && !!url,
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
  const { supported, fetched, enabled, url, deepLinkUrl, toggle } =
    useLure(flag);
  const { good, checked } = useLureLinkChecked(url, !!enabled);

  const status = useMemo(() => {
    if (!supported) {
      return 'unsupported';
    }

    if (fetched && !enabled) {
      return 'disabled';
    }

    if (url && checkOldLureToken(url)) {
      return 'stale';
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

function checkOldLureToken(url: string | undefined) {
  if (!url) return false;
  const parts = url.split('/');
  const token = parts.pop();
  const ship = parts.pop();
  return ship && token && ship.startsWith('~');
}
