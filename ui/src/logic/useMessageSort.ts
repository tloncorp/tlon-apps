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
  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({
    defaultSort: RECENT,
    sortOptions,
  });

  function sortMessages(briefs: ChatBriefs) {
    const accessors: Record<string, (k: string, v: ChatBrief) => string> = {
      [RECENT]: (flag: string, _brief: ChatBrief) => `chat/${flag}`,
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
