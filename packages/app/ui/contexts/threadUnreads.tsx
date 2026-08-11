import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ReactNode, createContext, useContext, useMemo } from 'react';

type ThreadUnreadsState = Map<string, db.ThreadUnreadState> | null;

const Context = createContext<ThreadUnreadsState>(null);

export const useThreadUnreads = () => useContext(Context);

export const ThreadUnreadsProvider = ({
  channelId,
  enabled,
  children,
}: {
  channelId: string;
  enabled: boolean;
  children: ReactNode;
}) => {
  const { data } = store.useLiveThreadUnreadsByChannel(
    enabled ? channelId : null
  );

  // Stay null until the query actually yields rows. An authoritative-but-empty
  // map would suppress dots that callers' fallback data would have shown —
  // both during the initial load and after a failed fetch, where the query
  // reports itself as fetched but has no data.
  const value = useMemo(() => {
    if (!enabled || data === undefined) return null;
    const map = new Map<string, db.ThreadUnreadState>();
    for (const unread of data) {
      if (unread.threadId) map.set(unread.threadId, unread);
    }
    return map;
  }, [enabled, data]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
