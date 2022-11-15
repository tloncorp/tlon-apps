import { useBriefs } from '@/state/chat';
import { useBriefs as useHeapBriefs } from '@/state/heap/heap';
import { useBriefs as useDiaryBriefs } from '@/state/diary';
import _ from 'lodash';

export default function useAllBriefs() {
  const chBriefs = useBriefs();
  const heBriefs = useHeapBriefs();
  const diBriefs = useDiaryBriefs();

  return {
    ..._.mapKeys(chBriefs, (v, k) => `chat/${k}`),
    ..._.mapKeys(heBriefs, (v, k) => `heap/${k}`),
    ..._.mapKeys(diBriefs, (v, k) => `diary/${k}`),
  };
}
