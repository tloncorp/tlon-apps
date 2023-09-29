import { DMUnread, DMUnreads } from '@/types/dms';
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

  function sortMessages(unreads: DMUnreads) {
    const accessors: Record<string, (k: string, v: DMUnread) => string> = {
      [RECENT]: (flag: string, _unread: DMUnread) => `chat/${flag}`,
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
