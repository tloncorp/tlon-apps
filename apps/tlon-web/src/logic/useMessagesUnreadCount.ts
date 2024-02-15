import { nestToFlag, whomIsDm, whomIsMultiDm, whomIsNest } from '@/logic/utils';
import { useChatStoreChannelUnreads } from '@/state/channel/channel';
import { useChatStoreDmUnreads } from '@/state/chat';
import { usePinnedChats } from '@/state/pins';
import { useMessagesFilter } from '@/state/settings';
import { useMemo } from 'react';

export default function useMessagesUnreadCount(): number {
  const dmUnreads = useChatStoreDmUnreads();
  const channelUnreads = useChatStoreChannelUnreads();
  const messagesFilter = useMessagesFilter();
  const pins = usePinnedChats();

  const dmUnreadsCount = useMemo(() => dmUnreads.length, [dmUnreads]);
  const chatChannelUnreadsCount = useMemo(
    () => channelUnreads.length,
    [channelUnreads]
  );

  const pinnedDmUnreadsCount = useMemo(
    () =>
      pins
        .filter((pin) => whomIsDm(pin) || whomIsMultiDm(pin))
        .reduce((accum, whom) => {
          const unread = dmUnreads.find((un) => un === whom);
          return unread ? accum + 1 : accum;
        }, 0),
    [pins, dmUnreads]
  );

  const pinnedChatUnreadsCount = useMemo(
    () =>
      pins
        .filter((pin) => whomIsNest(pin))
        .reduce((accum, whom) => {
          const unread = channelUnreads.find((un) => {
            const [_, flag] = nestToFlag(whom);
            return un === flag;
          });
          return unread ? accum + 1 : accum;
        }, 0),
    [pins, channelUnreads]
  );

  const unreadCount = useMemo(() => {
    switch (messagesFilter) {
      case 'All Messages':
        return dmUnreadsCount + chatChannelUnreadsCount;
      case 'Group Channels':
        return chatChannelUnreadsCount + pinnedDmUnreadsCount;
      case 'Direct Messages':
      default:
        return dmUnreadsCount + pinnedChatUnreadsCount;
    }
  }, [
    messagesFilter,
    dmUnreadsCount,
    chatChannelUnreadsCount,
    pinnedDmUnreadsCount,
    pinnedChatUnreadsCount,
  ]);

  return unreadCount;
}
