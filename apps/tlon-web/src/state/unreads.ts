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
  notify: boolean;
  count: number;
  combined: {
    status: ReadStatus;
    count: number;
    notify: boolean;
  };
  recency: number;
  lastUnread?: {
    id: string;
    time: string;
  };
  children: string[];
  readTimeout: number;
  summary: ActivitySummary; // lags behind actual unread, only gets update if unread
}

export interface Unreads {
  [source: string]: Unread;
}

export interface UnreadsStore {
  loaded: boolean;
  sources: Unreads;
  seen: (whom: string) => void;
  read: (whom: string) => void;
  delayedRead: (whom: string, callback: () => void) => void;
  handleUnread: (whom: string, unread: ActivitySummary) => void;
  update: (unreads: Activity) => void;
}

export const unreadStoreLogger = createDevLogger('UnreadsStore', true);

export function isUnread(count: number, notify: boolean): boolean {
  return Boolean(count > 0 || notify);
}

function sumChildren(source: string, unreads: Unreads): number {
  const children = unreads[source]?.children || [];
  return children.reduce((acc, child) => acc + (unreads[child]?.count || 0), 0);
}

function getUnread(
  source: string,
  summary: ActivitySummary,
  unreads: Unreads
): Unread {
  const topNotify = summary.unread?.notify || false;
  const topCount = summary.unread?.count || 0;
  const combinedCount = source.startsWith('group/')
    ? sumChildren(source, unreads)
    : summary.count || 0;
  const combinedNotify = summary.notify;
  return {
    children: summary.children,
    recency: summary.recency,
    readTimeout: 0,
    notify: topNotify,
    count: topCount,
    status: isUnread(topCount, topNotify) ? 'unread' : 'read',
    combined: {
      count: combinedCount,
      notify: combinedNotify,
      status: isUnread(combinedCount, combinedNotify) ? 'unread' : 'read',
    },
    lastUnread: !summary.unread
      ? undefined
      : {
          id: summary.unread.id,
          time: summary.unread.time,
        },
    // todo account for children "seen"
    summary,
  };
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
  notify: false,
  count: 0,
  combined: {
    status: 'read',
    count: 0,
    notify: false,
  },
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
          draft.sources[key] = getUnread(key, summary, draft.sources);
        });
      })
    );
  },
  handleUnread: (key, summary) => {
    set(
      produce((draft: UnreadsStore) => {
        const source = draft.sources[key] || emptyUnread();
        unreadStoreLogger.log('unread', key, source, summary);
        draft.sources[key] = getUnread(key, summary, draft.sources);
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
      unread: acc.unread || source.combined.status === 'unread',
      count: acc.count + source.combined.count,
      notify: acc.notify || source.combined.notify,
    };
  }, defaultUnread);
}

export function useUnreads() {
  return useUnreadsStore(useCallback((s) => s.sources, []));
}

export function useUnread(key: string): Unread | undefined {
  return useUnreadsStore(useCallback((s) => s.sources[key], [key]));
}
