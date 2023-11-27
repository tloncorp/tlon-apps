import { DMUnread } from '@/types/dms';
import { Unread } from '@/types/channel';
import useSidebarSort, {
  RECENT,
  Sorter,
  useRecentSort,
} from './useSidebarSort';

export default function useMessageSort() {
  const sortRecent = useRecentSort();
  const sortOptions: Record<string, Sorter> = {
    [RECENT]: sortRecent,
  };
  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({
    defaultSort: RECENT,
    sortOptions,
  });

  function sortMessages(unreads: Record<string, Unread | DMUnread>) {
    const accessors: Record<
      string,
      (k: string, v: Unread | DMUnread) => string
    > = {
      [RECENT]: (flag: string, _unread: Unread | DMUnread) => flag,
    };

    return sortRecordsBy(unreads, accessors[sortFn], true);
  }

  return {
    setSortFn,
    sortFn,
    sortMessages,
    sortOptions,
  };
}
