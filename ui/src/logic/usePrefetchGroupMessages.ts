import { useCallback, useEffect } from 'react';
import { useGroup } from '@/state/groups';
import { useChatState } from '@/state/chat';
import { asyncForEach } from '@/lib';
import { nestToFlag } from './utils';

/**
 * On load, prefetches the messages for the group that the user is currently in.
 * The sidebar's recent sort depends on the messages being present in the store.
 *
 * @param flag The group's flag
 */
export default function usePrefetchGroupMessages(flag: string) {
  const group = useGroup(flag);
  const { initialize } = useChatState.getState();

  const fetchChannel = useCallback(
    async (channel) => {
      const [, chFlag] = nestToFlag(channel);
      initialize(chFlag);
    },
    [initialize]
  );

  const fetchAll = useCallback(async () => {
    await asyncForEach(Object.keys(group?.channels ?? {}), fetchChannel);
  }, [fetchChannel, group]);

  useEffect(() => {
    if (!group) {
      return;
    }

    fetchAll();
  }, [fetchAll, group]);
}
