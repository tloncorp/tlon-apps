import { useBriefs } from '@/state/chat';
import { useBriefs as useChannelBriefs } from '@/state/channel/channel';
import _ from 'lodash';
import { useMemo } from 'react';

export default function useAllBriefs() {
  const briefs = useChannelBriefs();
  const chBriefs = useBriefs();
  const heBriefs = useMemo(
    () => _.pickBy(briefs, (v, k) => k.startsWith('heap')),
    [briefs]
  );
  const diBriefs = useMemo(
    () => _.pickBy(briefs, (v, k) => k.startsWith('diary')),
    [briefs]
  );

  return useMemo(
    () => ({
      chat: chBriefs,
      heap: heBriefs,
      diary: diBriefs,
    }),
    [chBriefs, heBriefs, diBriefs]
  );
}
