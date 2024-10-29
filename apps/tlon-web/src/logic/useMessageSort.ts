import { ActivitySummary } from '@tloncorp/shared/urbit';

import { RECENT_SORT } from '@/constants';

import useSidebarSort, { Sorter, useRecentSort } from './useSidebarSort';

export default function useMessageSort() {
  const sortRecent = useRecentSort();
  const sortOptions: Record<string, Sorter> = {
    [RECENT_SORT]: sortRecent,
  };
  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({
    defaultSort: RECENT_SORT,
    sortOptions,
  });

  function sortMessages(activity: Record<string, ActivitySummary>) {
    const accessors: Record<string, (k: string, v: ActivitySummary) => string> =
      {
        [RECENT_SORT]: (flag: string, _unread: ActivitySummary) => flag,
      };

    return sortRecordsBy(
      activity,
      accessors[sortFn] || accessors[RECENT_SORT],
      true
    );
  }

  return {
    setSortFn,
    sortFn,
    sortMessages,
    sortOptions,
  };
}
