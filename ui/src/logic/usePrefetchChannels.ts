import { useCallback, useEffect } from 'react';
import { useGroup } from '@/state/groups';
import { useChatState } from '@/state/chat';
import { asyncForEach } from '@/lib';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { nestToFlag } from './utils';

/**
 * On load, prefetches the messages for the group that the user is currently in.
 * The sidebar's recent sort depends on the messages being present in the store.
 *
 * @param flag The group's flag
 */
export default function usePrefetchChannels(flag: string) {
  const group = useGroup(flag);
  const { initialize: initializeChat } = useChatState.getState();
  const { initialize: initializeDiary } = useDiaryState.getState();
  const { initialize: initializeHeap } = useHeapState.getState();

  const fetchChannel = useCallback(
    async (channel) => {
      const [chType, chFlag] = nestToFlag(channel);
      switch (chType) {
        case 'chat':
          initializeChat(chFlag);
          break;
        case 'diary':
          initializeDiary(chFlag);
          break;
        case 'heap':
          initializeHeap(chFlag);
          break;
        default:
          break;
      }
    },
    [initializeChat, initializeDiary, initializeHeap]
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
