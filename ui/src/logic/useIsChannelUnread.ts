import { ChatStore, useChatStore } from '@/chat/useChatStore';
import useAllBriefs from '@/logic/useAllBriefs';
import { useCallback } from 'react';
import { nestToFlag } from './utils';

const selChats = (s: ChatStore) => s.chats;

export default function useIsChannelUnread() {
  const briefs = useAllBriefs();
  const chats = useChatStore(selChats);

  /**
   * A Channel is unread if it's brief has new unseen items
   */
  const isChannelUnread = useCallback(
    (nest: string) => {
      const [app, chFlag] = nestToFlag(nest);
      const unread = chats[chFlag]?.unread;

      if (app === 'chat') {
        return unread && !unread.seen;
      }

      return (briefs[nest]?.count ?? 0) > 0;
    },
    [briefs, chats]
  );

  return {
    isChannelUnread,
  };
}
