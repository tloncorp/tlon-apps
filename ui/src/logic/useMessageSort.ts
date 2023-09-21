import { DMBrief, DMBriefs } from '@/types/dms';
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

  function sortMessages(briefs: DMBriefs) {
    const accessors: Record<string, (k: string, v: DMBrief) => string> = {
      [RECENT]: (flag: string, _brief: DMBrief) => `chat/${flag}`,
    };

    return sortRecordsBy(briefs, accessors[sortFn], true);
  }

  return {
    setSortFn,
    sortFn,
    sortMessages,
    sortOptions,
  };
}
