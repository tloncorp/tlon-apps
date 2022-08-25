import useAllBriefs from '@/logic/useAllBriefs';
import { useNotifications } from '@/notifications/useNotifications';
import { useCallback } from 'react';

export default function useIsChannelUnread(groupFlag: string) {
  const { notifications } = useNotifications(groupFlag);
  const briefs = useAllBriefs();

  /**
   * A Channel is unread if:
   * - it's brief has new unseen items, or
   * - any of its bins is unread and matches the chFlag
   */
  const isChannelUnread = useCallback(
    (chFlag: string) => {
      const hasActivity = (briefs[chFlag]?.count ?? 0) > 0;

      return (
        hasActivity ||
        notifications.some((n) =>
          n.bins.some(
            (b) => b.unread && b.topYarn?.rope.channel?.includes(chFlag)
          )
        )
      );
    },
    [briefs, notifications]
  );

  return {
    isChannelUnread,
  };
}
