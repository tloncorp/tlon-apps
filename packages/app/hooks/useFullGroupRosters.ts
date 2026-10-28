import * as store from '@tloncorp/shared/store';
import { useEffect, useState } from 'react';

import { makeKeyedFetches } from './keyedFetches';

/**
 * Fetches each group's full member list, once per session. Init and changes
 * carry only 15 seats of a larger group, so a member's seat can be missing
 * from this device until this runs.
 */
export function useFullGroupRosters(groupIds: string[]) {
  const sessionStartTime = store.useCurrentSession()?.startTime;
  const key = groupIds.join('\n');
  // The list shrinks as rosters arrive. A group still on it keeps its fetch:
  // syncGroup ignores a second call for a group whose first is not done, so
  // one cancelled here could not be started again in the same breath.
  const [fetches] = useState(() =>
    makeKeyedFetches({
      // syncGroup skips groups already fetched this session. wholeRoster:
      // a big group otherwise syncs only its light roster.
      fetch: (groupId, abortSignal) =>
        store.syncGroup(
          groupId,
          {
            priority: store.SyncPriority.Low,
            retry: true,
            abortSignal,
          },
          { wholeRoster: true }
        ),
      onError: (groupId, error) =>
        console.error('group roster sync failed', groupId, error),
    })
  );
  useEffect(() => {
    fetches.want(
      key && sessionStartTime !== undefined ? key.split('\n') : [],
      sessionStartTime
    );
  }, [fetches, key, sessionStartTime]);
  // Cancel what is still queued when the screen goes away.
  useEffect(() => fetches.stop, [fetches]);
}
