import { useNotifications } from '@/notifications/useNotifications';
import { useGroups } from '@/state/groups';
import { useCallback } from 'react';
import useAllBriefs from './useAllBriefs';

export default function useIsGroupUnread() {
  const { notifications } = useNotifications();
  const groups = useGroups();
  const briefs = useAllBriefs();

  /**
   * A Group is unread if
   * - any of it's Channels have new items in their corresponding briefs
   * - any of its Channels are unread (bin is unread, group matches flag, rope
   *   channel matchs chFlag)
   */
  const isGroupUnread = useCallback(
    (flag: string) => {
      const group = groups[flag];
      const chNests = group ? Object.keys(group.channels) : [];

      const hasActivity = chNests.reduce(
        (memo, nest) => memo || (briefs[nest]?.count ?? 0) > 0,
        false
      );

      return (
        hasActivity ||
        notifications.some((n) =>
          n.bins.some(
            (b) =>
              b.unread &&
              b.topYarn?.rope.group === flag &&
              b.topYarn?.rope.channel &&
              chNests.includes(b.topYarn?.rope.channel)
          )
        )
      );
    },
    [briefs, groups, notifications]
  );

  return {
    isGroupUnread,
  };
}
