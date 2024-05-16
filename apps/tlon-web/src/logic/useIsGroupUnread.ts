import { useCallback } from 'react';

import { useUnreads } from '@/state/activity';
import { useGroups } from '@/state/groups';

interface UnreadInfo {
  unread: boolean;
  count: number;
  notify: boolean;
}

const defaultUnread = {
  unread: false,
  count: 0,
  notify: false,
};

export default function useGroupUnread() {
  const unreads = useUnreads();
  const getGroupUnread = useCallback(
    (flag: string): UnreadInfo => {
      const unread = unreads?.[flag];
      if (!unread) {
        return defaultUnread;
      }

      return {
        unread: !!unread.unread,
        count: unread.count,
        notify: unread.notify,
      };
    },
    [unreads]
  );

  return {
    getGroupUnread,
  };
}

export function useCombinedGroupsUnread() {
  const groups = useGroups();
  const { getGroupUnread } = useGroupUnread();
  if (!groups) return defaultUnread;

  return Object.keys(groups).reduce((info, flag) => {
    const { unread, count, notify } = getGroupUnread(flag);
    return {
      unread: info.unread || unread,
      count: info.count + count,
      notify: info.notify || notify,
    };
  }, defaultUnread);
}
