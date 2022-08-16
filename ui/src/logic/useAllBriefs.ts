import { useBriefs } from '@/state/chat';
import { useBriefs as useHeapBriefs } from '@/state/heap/heap';
import { useBriefs as useDiaryBriefs } from '@/state/diary';

export default function useAllBriefs() {
  const chBriefs = useBriefs();
  const heBriefs = useHeapBriefs();
  const diBriefs = useDiaryBriefs();

  return {
    ...chBriefs,
    ...heBriefs,
    ...diBriefs,
  };
}
