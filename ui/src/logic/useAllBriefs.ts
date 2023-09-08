import { useBriefs } from '@/state/chat';
import { useHeapBriefs } from '@/state/heap/heap';
import { useBriefs as useChannelBriefs } from '@/state/channel/channel';
import _ from 'lodash';
import { useMemo } from 'react';

export default function useAllBriefs() {
  const chBriefs = useBriefs();
  const heBriefs = useHeapBriefs();
  const diBriefs = useChannelBriefs();

  return useMemo(
    () => ({
      chat: chBriefs,
      heap: heBriefs,
      diary: diBriefs,
    }),
    [chBriefs, heBriefs, diBriefs]
  );
}
