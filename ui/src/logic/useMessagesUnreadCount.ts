import { useMemo } from 'react';
import { useDmUnreads } from '@/state/chat';
import { useUnreads } from '@/state/channel/channel';
import { useMessagesFilter } from '@/state/settings';
import { usePinnedChats } from '@/state/pins';
import { whomIsDm, whomIsMultiDm, whomIsNest } from '@/logic/utils';

export default function useMessagesUnreadCount(): number {
  const { data: dmUnreads } = useDmUnreads();
  const channelUnreads = useUnreads();
  const messagesFilter = useMessagesFilter();
  const pins = usePinnedChats();

  const dmUnreadsCount = useMemo(
    () =>
      Object.entries(dmUnreads).reduce(
        (acc, [_whom, unread]) => (unread.count > 0 ? acc + 1 : acc),
        0
      ),
    [dmUnreads]
  );
  const chatChannelUnreadsCount = useMemo(
    () =>
      Object.entries(channelUnreads).reduce(
        (acc, [channel, unread]) =>
          unread.count > 0 && channel.includes('chat/') ? acc + 1 : acc,
        0
      ),
    [channelUnreads]
  );

  const pinnedDmUnreadsCount = useMemo(
    () =>
      pins
        .filter((pin) => whomIsDm(pin) || whomIsMultiDm(pin))
        .reduce((accum, whom) => {
          const unread = dmUnreads[whom];
          return unread?.count > 0 ? accum + 1 : accum;
        }, 0),
    [pins, dmUnreads]
  );

  const pinnedChatUnreadsCount = useMemo(
    () =>
      pins
        .filter((pin) => whomIsNest(pin))
        .reduce((accum, whom) => {
          const unread = channelUnreads[whom];
          return unread?.count > 0 ? accum + 1 : accum;
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
