import { useBriefs } from '@/state/chat';
import { useBriefs as useHeapBriefs } from '@/state/heap/heap';

export default function useAllBriefs() {
  const chBriefs = useBriefs();
  const heBriefs = useHeapBriefs();

  return {
    ...chBriefs,
    ...heBriefs,
  };
}
