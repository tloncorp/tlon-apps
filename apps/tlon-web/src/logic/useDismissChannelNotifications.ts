import { useEffect } from 'react';

import { useIsChannelUnread } from '@/logic/channel';
import { useNotifications } from '@/notifications/useNotifications';
import { useRouteGroup } from '@/state/groups';
import { useSawRopeMutation } from '@/state/hark';

import { nestToFlag } from './utils';

interface UseDismissChannelProps {
  nest: string;
  markRead: (flag: string) => Promise<void> | void;
  isMarking: boolean;
}

export default function useDismissChannelNotifications({
  nest,
  markRead,
  isMarking,
}: UseDismissChannelProps) {
  const flag = useRouteGroup();
  const [, chFlag] = nestToFlag(nest);
  const unread = useIsChannelUnread(nest);
  const { notifications } = useNotifications(flag);
  const { mutate: sawRopeMutation } = useSawRopeMutation();

  /**
   * TODO: Confirm expected behavior for navigating to a Channel with Unreads.
   *
   * Does clicking on an Unread Channel automatically scrollback to the
   * last read message? Should it only be dismissed when reaching the end of
   * new messages?
   */
  // dismiss unread notifications while viewing channel
  useEffect(() => {
    if (nest && unread && !isMarking) {
      // dismiss unread
      markRead(chFlag);
      // iterate bins, saw each rope
      notifications.forEach((n) => {
        n.skeins.forEach((b) => {
          if (
            b.unread &&
            b.top?.rope.channel &&
            b.top.rope.channel.includes(chFlag)
          ) {
            sawRopeMutation({ rope: b.top.rope });
          }
        });
      });
    }
  }, [
    nest,
    chFlag,
    markRead,
    unread,
    notifications,
    sawRopeMutation,
    isMarking,
  ]);
}
