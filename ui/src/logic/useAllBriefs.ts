import { useBriefs } from '@/state/chat';
import { useBriefs as useHeapBriefs } from '@/state/heap/heap';
import { useDiaryBriefs } from '@/state/diary';
import _ from 'lodash';
import { useMemo } from 'react';

export default function useAllBriefs() {
  const chBriefs = useBriefs();
  const heBriefs = useHeapBriefs();
  const diBriefs = useDiaryBriefs();

  return useMemo(
    () => ({
      chat: chBriefs,
      heap: heBriefs,
      diary: diBriefs,
    }),
    [chBriefs, heBriefs, diBriefs]
  );
}
