import { useChannelFlag } from '@/hooks';
import { useNotifications } from '@/notifications/useNotifications';
import useHarkState from '@/state/hark';
import { useEffect } from 'react';

export default function useDismissChannelNotifications() {
  const chFlag = useChannelFlag();
  const { isChannelUnread, notifications } = useNotifications();

  // dismiss unread notifications while viewing channel
  useEffect(() => {
    if (chFlag && isChannelUnread(chFlag)) {
      // iterate bins, saw each rope
      notifications.forEach((n) => {
        n.bins.forEach((b) => {
          if (
            b.unread &&
            b.topYarn?.rope.channel &&
            b.topYarn.rope.channel.includes(chFlag)
          ) {
            useHarkState.getState().sawRope(b.topYarn.rope);
          }
        });
      });
    }
  }, [chFlag, isChannelUnread, notifications]);
}
