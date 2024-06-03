import { Unread } from '@tloncorp/shared/dist/urbit/channel';
import { DMUnread } from '@tloncorp/shared/dist/urbit/dms';

import { RECENT_SORT } from '@/constants';
import { CohortUnread } from '@/state/broadcasts';

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

  function sortMessages(
    unreads: Record<string, Unread | DMUnread | CohortUnread>
  ) {
    const accessors: Record<
      string,
      (k: string, v: Unread | DMUnread | CohortUnread) => string
    > = {
      [RECENT_SORT]: (
        flag: string,
        _unread: Unread | DMUnread | CohortUnread
      ) => flag,
    };

    return sortRecordsBy(
      unreads,
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
