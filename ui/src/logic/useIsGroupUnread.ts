import { useCallback } from 'react';
import { useNotifications } from '@/notifications/useNotifications';
import { useGroups } from '@/state/groups';
import { useCheckChannelUnread } from './useIsChannelUnread';

export default function useIsGroupUnread() {
  const { notifications } = useNotifications();
  const groups = useGroups();
  const isChannelUnread = useCheckChannelUnread();

  /**
   * A Group is unread if
   * - any of it's Channels have new items in their corresponding briefs
   * - any of its Channels are unread (bin is unread, rope channel matches
   *   chFlag)
   */
  const isGroupUnread = useCallback(
    (flag: string) => {
      const group = groups[flag];
      const chNests = group ? Object.keys(group.channels) : [];

      const hasActivity = chNests.reduce(
        (memo, nest) => memo || isChannelUnread(nest),
        false
      );

      return (
        hasActivity ||
        notifications.some((n) =>
          n.bins.some(
            (b) =>
              b.unread &&
              b.topYarn?.rope.channel &&
              chNests.includes(b.topYarn?.rope.channel)
          )
        )
      );
    },
    [groups, notifications, isChannelUnread]
  );

  return {
    isGroupUnread,
  };
}
