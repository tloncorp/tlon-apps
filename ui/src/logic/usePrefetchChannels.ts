import { useCallback, useEffect } from 'react';
import { chunk } from 'lodash';
import { useGroup } from '@/state/groups';
import { useChatState } from '@/state/chat';
import { asyncForEach } from '@/lib';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { FETCH_BATCH_SIZE } from '@/constants';
import { nestToFlag } from './utils';
import useRecentChannel from './useRecentChannel';

/**
 * On load, prefetches the messages for the group that the user is currently in.
 * The sidebar's recent sort depends on the messages being present in the store.
 *
 * @param flag The group's flag
 */
export default function usePrefetchChannels(flag: string) {
  const group = useGroup(flag);
  const { recentChannel } = useRecentChannel(flag);
  const { initialize: initializeChat } = useChatState.getState();
  const { initialize: initializeDiary } = useDiaryState.getState();
  const { initialize: initializeHeap } = useHeapState.getState();

  const fetchChannel = useCallback(
    async (channel) => {
      const [chType, chFlag] = nestToFlag(channel);
      switch (chType) {
        case 'chat':
          await initializeChat(chFlag);
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
    // first, prioritize the recent channel
    if (recentChannel && recentChannel !== '') {
      await fetchChannel(recentChannel);
    }

    // defer the rest, in batches
    const channels = Object.keys(group?.channels ?? {}).filter(
      (c) => c !== recentChannel
    );
    const batched = chunk(channels, FETCH_BATCH_SIZE);
    batched.forEach(async (batch) => {
      await asyncForEach(batch, fetchChannel);
    });
  }, [fetchChannel, group, recentChannel]);

  useEffect(() => {
    if (!group) {
      return;
    }

    fetchAll();
  }, [fetchAll, group]);
}
