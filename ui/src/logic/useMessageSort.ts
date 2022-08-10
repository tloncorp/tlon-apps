import { ChatBrief, ChatBriefs } from '@/types/chat';
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
  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({ sortOptions });

  function sortMessages(briefs: ChatBriefs) {
    const accessors: Record<string, (k: string, v: ChatBrief) => string> = {
      [RECENT]: (flag: string, _brief: ChatBrief) => flag,
    };

    return sortRecordsBy(briefs, accessors[sortFn], sortFn === RECENT);
  }

  return {
    setSortFn,
    sortFn,
    sortMessages,
    sortOptions,
  };
}
