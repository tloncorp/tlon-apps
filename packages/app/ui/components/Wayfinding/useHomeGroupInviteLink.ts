import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { enableGroupLinks, useGroup, useLure } from '@tloncorp/shared/store';
import { useEffect, useMemo, useRef } from 'react';

import {
  useCurrentUserId,
  useInviteService,
} from '../../contexts/appDataContext';

const logger = createDevLogger('useHomeGroupInviteLink', true);
const HOME_GROUP_SLUG = 'home-group';

type HomeGroupInviteState = 'ready' | 'loading' | 'unavailable';

function getHomeGroupId(currentUserId: string) {
  return `${currentUserId}/${HOME_GROUP_SLUG}`;
}

export function useHomeGroupInviteLink({ enabled }: { enabled: boolean }) {
  const currentUserId = useCurrentUserId();
  const inviteService = useInviteService();
  const cachedInviteLink = db.homeGroupInviteLink.useValue();
  const enabledGroupLinksRef = useRef<string | null>(null);

  const homeGroupId = useMemo(
    () =>
      enabled && currentUserId ? getHomeGroupId(currentUserId) : undefined,
    [currentUserId, enabled]
  );
  const { data: homeGroup, isLoading: homeGroupIsLoading } = useGroup({
    id: homeGroupId,
  });

  const shouldRecoverFromLure = enabled && !cachedInviteLink && !!homeGroup?.id;

  useEffect(() => {
    if (!shouldRecoverFromLure || !homeGroup?.id) {
      return;
    }

    if (enabledGroupLinksRef.current === homeGroup.id) {
      return;
    }

    enabledGroupLinksRef.current = homeGroup.id;
    enableGroupLinks(homeGroup.id).catch((error) => {
      logger.trackError('Wayfinding Home Group Invite Enable Failed', {
        groupId: homeGroup.id,
        error,
      });
    });
  }, [homeGroup?.id, shouldRecoverFromLure]);

  const { status: lureStatus, shareUrl } = useLure({
    flag: homeGroup?.id ?? '',
    inviteServiceEndpoint: inviteService.endpoint,
    inviteServiceIsDev: inviteService.isDev,
    disableLoading: !shouldRecoverFromLure,
  });

  const inviteUrl = cachedInviteLink ?? shareUrl ?? null;
  const state = useMemo<HomeGroupInviteState>(() => {
    if (inviteUrl) {
      return 'ready';
    }

    if (!enabled) {
      return 'unavailable';
    }

    if (!cachedInviteLink && homeGroupIsLoading) {
      return 'loading';
    }

    if (!homeGroup?.id) {
      return 'unavailable';
    }

    if (lureStatus === 'loading' || lureStatus === 'stale') {
      return 'loading';
    }

    return 'unavailable';
  }, [
    cachedInviteLink,
    enabled,
    homeGroup?.id,
    homeGroupIsLoading,
    inviteUrl,
    lureStatus,
  ]);

  return {
    inviteUrl,
    state,
  };
}
