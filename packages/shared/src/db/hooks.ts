import { useEffect, useMemo, useState } from 'react';

import { GetGroupsOptions, getContact } from './queries';
import { createUseQuery } from './query';
import { Group } from './types';
import queries from './wrappedQueries';

export const useContact = createUseQuery(getContact);

export const useAllUnreadsCounts = () => {
  const [counts, setCounts] = useState<{
    channels: number;
    dms: number;
    total: number;
  } | null>(null);
  useEffect(() => {
    queries.getAllUnreadsCounts().then((c) => setCounts(c ?? null));
  }, []);
  return counts;
};

export const useGroups = ({ includeUnjoined }: GetGroupsOptions) => {
  const [groups, setGroups] = useState<Group[] | null>(null);
  useEffect(() => {
    queries
      .getGroups({ sort: 'pinIndex', includeUnjoined })
      .then((c) => setGroups(c ?? null));
  }, [includeUnjoined]);
  return groups;
};

export const usePinnedGroups = (): null | {
  pinnedGroups?: Group[];
  unpinnedGroups?: Group[];
} => {
  const allGroups = useGroups({ sort: 'pinIndex' });
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
