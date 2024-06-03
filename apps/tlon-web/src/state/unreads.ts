import {
  Activity,
  ActivitySummary,
} from '@tloncorp/shared/dist/urbit/activity';
import produce from 'immer';
import { useCallback } from 'react';
import create from 'zustand';

import { createDevLogger } from '@/logic/utils';

export type ReadStatus = 'read' | 'seen' | 'unread';

/**
 *
 */
export interface Unread {
  status: ReadStatus;
  combinedStatus: ReadStatus;
  notify: boolean;
  count: number;
  combinedCount: number;
  recency: number;
  lastUnread?: {
    id: string;
    time: string;
  };
  children: string[];
  readTimeout: number;
  summary: ActivitySummary; // lags behind actual unread, only gets update if unread
}

export interface UnreadsStore {
  loaded: boolean;
  sources: {
    [source: string]: Unread;
  };
  seen: (whom: string) => void;
  read: (whom: string) => void;
  delayedRead: (whom: string, callback: () => void) => void;
  handleUnread: (whom: string, unread: ActivitySummary) => void;
  update: (unreads: Activity) => void;
}

export const unreadStoreLogger = createDevLogger('UnreadsStore', true);

export function isUnread(unread: ActivitySummary): boolean {
  return Boolean((unread.unread && unread.unread.count > 0) || unread.notify);
}

export function isCombinedUnread(unread: ActivitySummary): boolean {
  return Boolean(unread.count > 0 || unread.notify);
}

export const emptyUnread = (): Unread => ({
  summary: {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: [],
  },
  recency: 0,
  status: 'read',
  combinedStatus: 'read',
  notify: false,
  count: 0,
  combinedCount: 0,
  readTimeout: 0,
  children: [],
});
export const useUnreadsStore = create<UnreadsStore>((set, get) => ({
  sources: {},
  loaded: false,
  update: (summaries) => {
    set(
      produce((draft: UnreadsStore) => {
        draft.loaded = true;
        Object.entries(summaries).forEach(([key, summary]) => {
          const source = draft.sources[key];
          unreadStoreLogger.log('update', key, source, summary, draft.sources);

          draft.sources[key] = {
            ...(source || emptyUnread()),
            recency: summary.recency,
            readTimeout: 0,
            notify: summary.notify,
            count: summary.unread?.count || 0,
            combinedCount: summary.count || 0,
            lastUnread: !summary.unread
              ? undefined
              : {
                  id: summary.unread.id,
                  time: summary.unread.time,
                },
            status: isUnread(summary) ? 'unread' : 'read',
            combinedStatus: isCombinedUnread(summary) ? 'unread' : 'read',
            summary,
          };
          return;
        });
      })
    );
  },
  seen: (key) => {
    set(
      produce((draft: UnreadsStore) => {
        if (!draft.sources[key]) {
          draft.sources[key] = emptyUnread();
        }

        const source = draft.sources[key];

        unreadStoreLogger.log('seen', key);
        draft.sources[key] = {
          ...source,
          status: 'seen',
        };
      })
    );
  },
  read: (key) => {
    set(
      produce((draft: UnreadsStore) => {
        const source = draft.sources[key];
        if (!source) {
          return;
        }

        if (source.readTimeout) {
          unreadStoreLogger.log('clear delayedRead', key);
          clearTimeout(source.readTimeout);
        }

        unreadStoreLogger.log('read', key, JSON.stringify(source));
        draft.sources[key] = {
          ...source,
          status: 'read',
          readTimeout: 0,
        };
        unreadStoreLogger.log('post read', JSON.stringify(draft.sources[key]));
      })
    );
  },
  delayedRead: (key, cb) => {
    const { sources, read } = get();
    const source = sources[key] || emptyUnread();

    if (source.readTimeout) {
      clearTimeout(source.readTimeout);
    }

    const readTimeout = setTimeout(() => {
      read(key);
      cb();
    }, 15 * 1000); // 15 seconds

    set(
      produce((draft) => {
        const latest = draft.sources[key] || emptyUnread();
        unreadStoreLogger.log('delayedRead', key, source, { ...latest });
        draft.sources[key] = {
          ...latest,
          readTimeout,
        };
      })
    );
  },
  handleUnread: (key, summary) => {
    set(
      produce((draft: UnreadsStore) => {
        const source = draft.sources[key] || emptyUnread();

        /* TODO: there was initially logic here to mark read when we're on the chat and
            at the bottom of the scroll. This was very rarely firing since the scroller
            doesn't actually call that event very often and if it did, would clear thread
            unreads before they're seen. We should revisit once we have more granular control
            over what we mark read.
          */
        unreadStoreLogger.log('unread', key, source, summary);
        draft.sources[key] = {
          ...source,
          readTimeout: 0,
          recency: summary.recency,
          notify: summary.notify,
          count: summary.unread?.count || 0,
          combinedCount: summary.count || 0,
          lastUnread: !summary.unread
            ? undefined
            : {
                id: summary.unread.id,
                time: summary.unread.time,
              },
          status: isUnread(summary) ? 'unread' : 'read',
          combinedStatus: isCombinedUnread(summary) ? 'unread' : 'read',
          summary,
        };
      })
    );
  },
}));

const defaultUnread = {
  unread: false,
  count: 0,
  notify: false,
};
export function useCombinedChatUnreads() {
  const sources = useUnreadsStore(useCallback((s) => s.sources, []));
  return Object.entries(sources).reduce((acc, [key, source]) => {
    if (key === 'base' || key.startsWith('group')) {
      return acc;
    }

    return {
      unread: acc.unread || source.status === 'unread',
      count: acc.count + source.count,
      notify: acc.notify || source.notify,
    };
  }, defaultUnread);
}

export function useCombinedGroupUnreads() {
  const sources = useUnreadsStore(useCallback((s) => s.sources, []));
  return Object.entries(sources).reduce((acc, [key, source]) => {
    if (!key.startsWith('group')) {
      return acc;
    }

    return {
      unread: acc.unread || source.status === 'unread',
      count: acc.count + source.count,
      notify: acc.notify || source.notify,
    };
  }, defaultUnread);
}

export function useUnreads() {
  return useUnreadsStore(useCallback((s) => s.sources, []));
}

export function useUnread(key: string): Unread | undefined {
  return useUnreadsStore(useCallback((s) => s.sources[key], [key]));
}
