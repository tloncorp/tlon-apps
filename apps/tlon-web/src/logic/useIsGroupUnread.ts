import { useCallback } from 'react';

import { Unread, emptyUnread, useUnreads } from '@/state/unreads';

const defaultUnread = emptyUnread();

export default function useGroupUnread() {
  const unreads = useUnreads();
  const getGroupUnread = useCallback(
    (flag: string): Unread => {
      return unreads?.[`group/${flag}`] || defaultUnread;
    },
    [unreads]
  );

  return {
    getGroupUnread,
  };
}
