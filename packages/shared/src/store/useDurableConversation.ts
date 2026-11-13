import { getDurableClient } from '@tloncorp/api/client/durable';
import { useEffect } from 'react';
import { acquireDurableConversation } from './durableSync';

export function useDurableConversation(channelId: string, focused: boolean) {
  const local = Boolean(getDurableClient());
  useEffect(() => {
    if (local && focused) return acquireDurableConversation(channelId);
  }, [channelId, focused, local]);
  return !local || focused;
}
