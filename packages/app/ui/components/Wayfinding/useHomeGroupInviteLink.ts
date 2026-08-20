import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { extractNormalizedInviteLink } from '@tloncorp/shared/logic';
import { useEffect, useMemo, useRef } from 'react';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useGroupInviteLink } from './useGroupInviteLink';

const logger = createDevLogger('useHomeGroupInviteLink', true);
const HOME_GROUP_SLUG = 'home-group';

function getHomeGroupId(currentUserId: string) {
  return `${currentUserId}/${HOME_GROUP_SLUG}`;
}

/**
 * The home group's invite link, cached durably.
 *
 * `useGroupInviteLink` does the fetching; this adds the two things specific to
 * the home group — its well-known id, and a persisted link so the invite
 * survives a lure that has gone stale.
 */
export function useHomeGroupInviteLink({ enabled }: { enabled: boolean }) {
  const currentUserId = useCurrentUserId();
  const cachedInviteLink = db.homeGroupInviteLink.useValue();
  const cachedRecoveredInviteRef = useRef<string | null>(null);

  const homeGroupId = useMemo(
    () =>
      enabled && currentUserId ? getHomeGroupId(currentUserId) : undefined,
    [currentUserId, enabled]
  );

  // links cached by older versions carry the old share domain — normalize
  // in place so updaters share canonical links. same logout guard as the
  // personal-link migration: never write back after a session wipe
  useEffect(() => {
    if (!cachedInviteLink) {
      return;
    }
    const normalized = extractNormalizedInviteLink(cachedInviteLink);
    if (!normalized || normalized === cachedInviteLink) {
      return;
    }
    let cancelled = false;
    void db.homeGroupInviteLink.getValue(true).then((current) => {
      if (cancelled || current !== cachedInviteLink) {
        return;
      }
      void db.homeGroupInviteLink.setValue(normalized);
    });
    return () => {
      cancelled = true;
    };
  }, [cachedInviteLink]);

  const { inviteUrl, state, shareUrl } = useGroupInviteLink({
    enabled,
    groupId: homeGroupId,
    cachedLink: cachedInviteLink,
  });

  useEffect(() => {
    if (!enabled || cachedInviteLink || !shareUrl) {
      return;
    }
    if (cachedRecoveredInviteRef.current === shareUrl) {
      return;
    }
    cachedRecoveredInviteRef.current = shareUrl;
    db.homeGroupInviteLink.setValue(shareUrl).catch((error) => {
      cachedRecoveredInviteRef.current = null;
      logger.trackError('Wayfinding Home Group Invite Cache Failed', {
        error,
        groupId: homeGroupId,
      });
    });
  }, [cachedInviteLink, enabled, homeGroupId, shareUrl]);

  return { inviteUrl, state };
}
