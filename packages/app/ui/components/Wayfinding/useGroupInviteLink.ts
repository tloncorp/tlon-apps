import { createDevLogger } from '@tloncorp/shared';
import { enableGroupLinks, useGroup, useLure } from '@tloncorp/shared/store';
import { useEffect, useMemo, useRef } from 'react';

import { useInviteService } from '../../contexts/appDataContext';

const logger = createDevLogger('useGroupInviteLink', true);

export type GroupInviteState = 'ready' | 'loading' | 'unavailable';

/**
 * A shareable invite link for one group.
 *
 * The generic core: enable link sharing on the group, ask the invite service
 * for a URL, and reduce the several ways that can be in flight into three
 * states a screen can act on. A caller that wants a durable cached link can
 * layer that on top; nothing does today.
 *
 * `state` distinguishes 'loading' from 'unavailable' deliberately: a screen
 * showing a spinner forever is worse than one that says it could not make a
 * link, and only the caller knows which of those to render.
 */
export function useGroupInviteLink({
  enabled,
  groupId,
  cachedLink,
}: {
  enabled: boolean;
  groupId: string | undefined;
  /**
   * A link a caller already has. When present the hook does no work and
   * reports 'ready' — that is what makes the cached path free rather than a
   * race against a fresh lure fetch.
   */
  cachedLink?: string | null;
}) {
  const inviteService = useInviteService();
  const enabledGroupLinksRef = useRef<string | null>(null);

  const { data: group, isLoading: groupIsLoading } = useGroup({
    id: enabled ? groupId : undefined,
  });

  const shouldFetch = enabled && !cachedLink && !!group?.id;

  useEffect(() => {
    if (!shouldFetch || !group?.id) {
      return;
    }
    if (enabledGroupLinksRef.current === group.id) {
      return;
    }
    enabledGroupLinksRef.current = group.id;
    enableGroupLinks(group.id).catch((error) => {
      logger.trackError('Group Invite Link Enable Failed', {
        groupId: group.id,
        error,
      });
    });
  }, [group?.id, shouldFetch]);

  const { status: lureStatus, shareUrl } = useLure({
    flag: group?.id ?? '',
    inviteServiceEndpoint: inviteService.endpoint,
    inviteServiceIsDev: inviteService.isDev,
    disableLoading: !shouldFetch,
  });

  const inviteUrl = cachedLink ?? shareUrl ?? null;

  const state = useMemo<GroupInviteState>(() => {
    if (inviteUrl) {
      return 'ready';
    }
    if (!enabled) {
      return 'unavailable';
    }
    if (!cachedLink && groupIsLoading) {
      return 'loading';
    }
    if (!group?.id) {
      return 'unavailable';
    }
    if (
      lureStatus === 'loading' ||
      lureStatus === 'stale' ||
      lureStatus === 'unsupported'
    ) {
      return 'loading';
    }
    return 'unavailable';
  }, [cachedLink, enabled, group?.id, groupIsLoading, inviteUrl, lureStatus]);

  return { inviteUrl, state, shareUrl };
}
