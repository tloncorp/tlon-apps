import { useMemo } from 'react';

import * as queries from './queries';
import { getContact } from './queries';
import { createUseQuery } from './query';
import { Group } from './types';

export const useContact = createUseQuery(getContact);

export const useAllUnreadsCounts = createUseQuery(queries.getAllUnreadsCounts);

export const useGroups = createUseQuery(queries.getGroups);

export const useGroupsForList = (): {
  pinnedGroups?: Group[];
  unpinnedGroups?: Group[];
} | null => {
  const { result: allGroups } = useGroups({ sort: 'pinIndex' });

  return useMemo(() => {
    // If we don't have groups yet, return null
    if (!allGroups) {
      return null;
    }
    // Groups are sorted by pinIndex, with those missing pinIndex at the end, so
    // we just find the first group without a pinIndex and split there.
    for (let i = 0; i < allGroups?.length; ++i) {
      if (allGroups[i] && typeof allGroups[i].pinIndex !== 'number') {
        return {
          pinnedGroups: allGroups.slice(0, i),
          unpinnedGroups: allGroups.slice(i),
        };
      }
    }
    // all groups are pinned
    return {
      pinnedGroups: allGroups,
    };
  }, [allGroups]);
};
