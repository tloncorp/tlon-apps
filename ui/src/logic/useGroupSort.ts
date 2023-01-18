import { get } from 'lodash';
import { useMemo } from 'react';
import { Group, Groups } from '@/types/groups';
import useChannelSort from './useChannelSort';
import useSidebarSort, {
  ALPHABETICAL,
  RECENT,
  sortAlphabetical,
  Sorter,
  useRecentSort,
} from './useSidebarSort';

export default function useGroupSort() {
  const sortRecent = useRecentSort();
  const sortOptions: Record<string, Sorter> = useMemo(
    () => ({
      [ALPHABETICAL]: sortAlphabetical,
      [RECENT]: sortRecent,
    }),
    [sortRecent]
  );
  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({ sortOptions });
  const { sortChannels } = useChannelSort();

  function sortGroups(groups: Groups) {
    const accessors: Record<string, (k: string, v: Group) => string> = {
      [ALPHABETICAL]: (_flag: string, group: Group) => get(group, 'meta.title'),
      [RECENT]: (flag: string, group: Group) => {
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
      groups,
      accessors[sortFn] || accessors[ALPHABETICAL],
      sortFn === RECENT
    );
  }

  return {
    setSortFn,
    sortFn,
    sortGroups,
    sortOptions,
  };
}
