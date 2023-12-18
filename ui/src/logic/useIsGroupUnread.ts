import { useCallback, useMemo } from 'react';
import { useGroups } from '@/state/groups';
import { useUnreads } from '@/state/channel/channel';
import { useCheckChannelUnread } from './channel';

export default function useIsGroupUnread() {
  const groups = useGroups();
  const isChannelUnread = useCheckChannelUnread();

  /**
   * A Group is unread if
   * - any of it's Channels have new items in their corresponding unreads
   * - any of its Channels are unread (bin is unread, rope channel matches
   *   chFlag)
   */
  const isGroupUnread = useCallback(
    (flag: string) => {
      const group = groups[flag];
      const chNests = group ? Object.keys(group.channels) : [];

      return chNests.reduce(
        (memo, nest) => memo || isChannelUnread(nest),
        false
      );
    },
    [groups, isChannelUnread]
  );

  return {
    isGroupUnread,
  };
}

export function useIsAnyGroupUnread() {
  const groups = useGroups();
  const { isGroupUnread } = useIsGroupUnread();
  if (!groups) return undefined;
  return Object.keys(groups).some((flag) => isGroupUnread(flag));
}

export function useGroupUnreadCounts() {
  const groups = useGroups();
  const unreads = useUnreads();

  const groupUnreads = useMemo(() => {
    const unreadCounts: { [key: string]: number } = {};

    Object.keys(groups).forEach((group) => {
      let groupUnreadCount = 0;
      Object.keys(groups[group].channels).forEach((channel) => {
        const channelData = unreads[channel];
        if (channelData) {
          groupUnreadCount += channelData.count;
        }
      });
      unreadCounts[group] = groupUnreadCount || 0;
    });

    return unreadCounts;
  }, [groups, unreads]);

  return groupUnreads;
}
