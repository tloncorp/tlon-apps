import {
  Activity,
  ActivitySummary,
} from '@tloncorp/shared/dist/urbit/activity';
import produce from 'immer';
import { useCallback, useMemo } from 'react';
import create from 'zustand';

import { createDevLogger } from '@/logic/utils';

import { SidebarFilter, useMessagesFilter } from './settings';

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
  children: Activity | null;
  parents: string[];
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
  update: (unreads: Activity) => void;
}

export const unreadStoreLogger = createDevLogger('UnreadsStore', true);

export function isUnread(count: number, notify: boolean): boolean {
  return Boolean(count > 0 || notify);
}

export interface ShortSummary {
  status: ReadStatus;
  count: number;
  notify: boolean;
}

function sumChildren(
  children: Activity,
  unreads: Unreads,
  top: ShortSummary,
  refresh = false
): ShortSummary {
  const { count, notify, status } = Object.entries(
    children
  ).reduce<ShortSummary>((acc, [key, child]) => {
    let status = acc.status;
    const childStatus = unreads[key]?.status;
    if (childStatus === 'unread') {
      status = 'unread';
    } else if (childStatus === 'seen' && status === 'read') {
      status = 'seen';
    }

    return {
      count: acc.count + (child.unread?.count || 0),
      notify: acc.notify || Boolean(child.unread?.notify),
      status,
    };
  }, top);

  return {
    count,
    notify,
    status: refresh ? status : isUnread(count, notify) ? 'unread' : 'read',
  };
}

function getUnread(
  source: string,
  summary: ActivitySummary,
  unreads: Unreads
): Unread {
  const topNotify = summary.unread?.notify || false;
  const topCount = summary.unread?.count || 0;
  const top: ShortSummary = {
    count: topCount,
    notify: topNotify,
    status: isUnread(topCount, topNotify) ? 'unread' : 'read',
  };

  return {
    ...top,
    parents: [],
    children: summary.children,
    recency: summary.recency,
    readTimeout: 0,
    summary,
    combined: shouldBeCombined(source)
      ? sumChildren(summary.children || {}, unreads, top)
      : {
          count: summary.count,
          notify: summary.notify,
          status: isUnread(summary.count, summary.notify) ? 'unread' : 'read',
        },
    lastUnread: !summary.unread
      ? undefined
      : {
          id: summary.unread.id,
          time: summary.unread.time,
        },
  };
}

export const emptyUnread = (): Unread => ({
  summary: {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: {},
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
  children: {},
  parents: [],
});

const sortOrder = {
  thread: 6,
  'dm-thread': 5,
  channel: 4,
  club: 3,
  ship: 2,
  group: 1,
  base: 0,
};

function shouldBeCombined(source: string): boolean {
  return (
    source.startsWith('group/') ||
    source.startsWith('ship/') ||
    source.startsWith('club/')
  );
}

function updateParents(parents: string[], draft: UnreadsStore) {
  parents.forEach((parent) => {
    const parentSrc = draft.sources[parent];
    const shouldUpdate = shouldBeCombined(parent);
    if (!parentSrc || !shouldUpdate) {
      return;
    }

    const combined = sumChildren(
      parentSrc.children || {},
      draft.sources,
      parentSrc,
      true
    );
    unreadStoreLogger.log('updating parent', parent, combined);
    draft.sources[parent] = {
      ...parentSrc,
      combined,
    };
  });

  return draft;
}

export const useUnreadsStore = create<UnreadsStore>((set, get) => ({
  sources: {},
  loaded: false,
  update: (summaries) => {
    set(
      produce((draft: UnreadsStore) => {
        draft.loaded = true;
        Object.entries(summaries)
          .sort(([a], [b]) => {
            const aKey = a.split('/')[0];
            const bKey = b.split('/')[0];

            return (
              sortOrder[bKey as keyof typeof sortOrder] -
              sortOrder[aKey as keyof typeof sortOrder]
            );
          })
          .forEach(([key, summary]) => {
            const source = draft.sources[key];
            unreadStoreLogger.log(
              'update',
              key,
              source,
              summary,
              draft.sources
            );
            const unread = getUnread(key, summary, draft.sources);
            draft.sources[key] = unread;

            Object.keys(unread.children || {}).forEach((child) => {
              const childSrc = draft.sources[child];
              if (!childSrc) {
                return;
              }

              draft.sources[child] = {
                ...childSrc,
                parents: childSrc.parents.includes(key)
                  ? childSrc.parents
                  : [...childSrc.parents, key],
              };
            });
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
          combined: !shouldBeCombined(key)
            ? source.combined
            : sumChildren(
                source.children || {},
                draft.sources,
                {
                  count: source.count,
                  notify: source.notify,
                  status: 'seen',
                },
                true
              ),
        };

        updateParents(source.parents, draft);
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
          combined: !shouldBeCombined(key)
            ? source.combined
            : sumChildren(
                source.children || {},
                draft.sources,
                {
                  count: source.count,
                  notify: source.notify,
                  status: 'read',
                },
                true
              ),
          readTimeout: 0,
        };
        unreadStoreLogger.log('post read', JSON.stringify(draft.sources[key]));
        updateParents(source.parents, draft);
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
export function useCombinedChatUnreads(messagesFilter: SidebarFilter) {
  const sources = useUnreadsStore(useCallback((s) => s.sources, []));
  return useMemo(
    () =>
      Object.entries(sources).reduce((acc, [key, source]) => {
        const isDm = key.startsWith('ship/') || key.startsWith('club/');
        const isChat = key.startsWith('channel/chat');
        const dms = messagesFilter === 'Direct Messages' && isDm;
        const chats = messagesFilter === 'Group Channels' && isChat;
        const all = messagesFilter === 'All Messages' && (isDm || isChat);

        if (!(dms || chats || all)) {
          return acc;
        }

        const isUnread = isDm
          ? source.combined.status === 'unread'
          : source.status === 'unread';
        return {
          unread: acc.unread || isUnread,
          count: acc.count + source.count,
          notify: acc.notify || source.notify,
        };
      }, defaultUnread),
    [sources, messagesFilter]
  );
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

window.unread = useUnreadsStore;
