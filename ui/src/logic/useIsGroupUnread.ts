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
      const chFlags = new Set(group ? Object.keys(group.channels) : []);

      const hasActivity = Array.from(chFlags).reduce(
        (memo, cf) => memo || (briefs[cf]?.count ?? 0) > 0,
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
              chFlags.has(b.topYarn?.rope.channel)
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
