import { useBriefs } from '@/state/chat';
import { useBriefs as useHeapBriefs } from '@/state/heap/heap';
import { useDiaryBriefs } from '@/state/diary';
import { useQuorumBriefs } from '@/state/quorum';
import _ from 'lodash';
import { useMemo } from 'react';

export default function useAllBriefs() {
  const chBriefs = useBriefs();
  const heBriefs = useHeapBriefs();
  const diBriefs = useDiaryBriefs();
  const boBriefs = useQuorumBriefs();

  return useMemo(
    () => ({
      chat: chBriefs,
      heap: heBriefs,
      diary: diBriefs,
      quorum: boBriefs,
    }),
    [chBriefs, heBriefs, diBriefs, boBriefs]
  );
}
