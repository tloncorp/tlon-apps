import { Group, Groups } from '@tloncorp/shared/dist/urbit/groups';
import { get } from 'lodash';
import { useCallback, useMemo } from 'react';

import { ALPHABETICAL_SORT, RECENT_SORT } from '@/constants';

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
        [RECENT_SORT]: (flag: string, group: Group) => `group/${flag}`,
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
