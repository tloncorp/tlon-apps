import { ALPHABETICAL_SORT, RECENT_SORT } from '@/constants';
import { Group, Groups } from '@/types/groups';
import { get } from 'lodash';
import { useCallback, useMemo } from 'react';

import { useChannelSort } from './channel';
import useSidebarSort, {
  Sorter,
  sortAlphabetical,
  useRecentSort,
} from './useSidebarSort';

export default function useGroupSort() {
  const sortRecent = useRecentSort();
  const sortOptions: Record<string, Sorter> = useMemo(
    () => ({
      [ALPHABETICAL_SORT]: sortAlphabetical,
      [RECENT_SORT]: sortRecent,
    }),
    [sortRecent]
  );
  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({
    sortOptions,
    flag: '~',
    defaultSort: RECENT_SORT,
  });
  const { sortChannels } = useChannelSort(RECENT_SORT);

  const sortGroups = useCallback(
    (groups?: Groups) => {
      const accessors: Record<string, (k: string, v: Group) => string> = {
        [ALPHABETICAL_SORT]: (_flag: string, group: Group) =>
          get(group, 'meta.title'),
        [RECENT_SORT]: (flag: string, group: Group) => {
          /**
           * Use the latest channel flag associated with the Group; otherwise
           * fallback to the Group flag itself, which won't be in the briefs and
           * thus use INFINITY by default
           */
          const channels = sortChannels(group.channels);
          return channels.length > 0 ? channels[0][0] : flag;
        },
      };

      return sortRecordsBy(
        groups || {},
        accessors[sortFn] || accessors[ALPHABETICAL_SORT],
        sortFn === RECENT_SORT
      );
    },
    [sortChannels, sortFn, sortRecordsBy]
  );

  return {
    setSortFn,
    sortFn,
    sortGroups,
    sortOptions,
  };
}
