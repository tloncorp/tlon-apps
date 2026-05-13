import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

const logger = createDevLogger('duplicateMembershipRepair', false);

/**
 * Returns a callback compatible with `useChannelOrdering`'s
 * `onDuplicatesDetected` prop. When duplicate channel memberships are
 * detected for the given group, force a group sync so the full-payload
 * write path in `db.insertGroups` reconciles local memberships against
 * the backend's canonical view.
 *
 * The callback is a no-op when `groupId` is not yet available (initial
 * loading state). Repeated calls for the same in-flight group are
 * coalesced by `syncGroup`'s own `groupSyncsInProgress` guard, and the
 * call site is already deduplicated by fingerprint inside
 * `useChannelOrdering`'s effect — so this hook does not need its own
 * retry-loop guard.
 *
 * Used by both native (`ManageChannelsScreenView.tsx`) and web/desktop
 * (`ManageChannelsScreenView.web.tsx`) since both paths share
 * `useChannelOrdering` and therefore share the duplicate-membership save
 * gate that this trigger repairs.
 */
export function useDuplicateMembershipRepair(
  groupId: string | undefined
): (duplicateChannelIds: string[]) => void {
  return useCallback(
    (duplicateChannelIds: string[]) => {
      if (!groupId) {
        return;
      }
      logger.warn(
        'duplicate channel memberships detected; forcing group sync',
        { groupId, duplicateChannelIds }
      );
      store
        .syncGroup(groupId, undefined, { force: true })
        .catch((e) =>
          logger.error('forced group sync failed for duplicate repair', e)
        );
    },
    [groupId]
  );
}
