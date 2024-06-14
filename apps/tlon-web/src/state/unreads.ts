import {
  Activity,
  ActivitySummary,
} from '@tloncorp/shared/dist/urbit/activity';
import produce from 'immer';
import { useCallback, useMemo } from 'react';
import create from 'zustand';

import { createDevLogger } from '@/logic/utils';

import { SidebarFilter } from './settings';

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

export const unreadStoreLogger = createDevLogger('UnreadsStore', false);

function getUnreadStatus(count: number, notify: boolean): ReadStatus {
  if (count > 0 || notify) {
    return 'unread';
  }

  return 'read';
}

export interface ShortSummary {
  status: ReadStatus;
  count: number;
  notify: boolean;
}

function combineStatus(status: ReadStatus, aggregate: ReadStatus): ReadStatus {
  if (status === 'unread') {
    return 'unread';
  }

  if (status === 'seen' && aggregate === 'read') {
    return 'seen';
  }

  return aggregate;
}

function shouldBeCombined(source: string): boolean {
  return (
    source.startsWith('group/') ||
    source.startsWith('ship/') ||
    source.startsWith('club/')
  );
}

function sumChildren(
  children: Activity,
  unreads: Unreads,
  top: ShortSummary,
  sumCounts: boolean
): ShortSummary {
  const { count, notify, status } = Object.entries(
    children
  ).reduce<ShortSummary>(
    (acc, [key, child]) => {
      let status = acc.status;
      const childStatus = unreads[key]?.status;

      // if we don't care about summing counts then we can skip aggregating
      // but if any child is notify then we need to take into account it's
      // status and notify values
      if (!(sumCounts || child.notify)) {
        return acc;
      }

      if (childStatus === 'unread') {
        status = 'unread';
      } else if (childStatus === 'seen' && status === 'read') {
        status = 'seen';
      }

      return {
        count: !sumCounts ? acc.count : acc.count + (child.unread?.count || 0),
        notify: acc.notify || Boolean(child.notify),
        status,
      };
    },
    // we start with nothing so that we can safely separate children summary
    // from the top level summary
    {
      count: 0,
      notify: false,
      status: 'read',
    }
  );

  const combined = {
    count: top.count + count,
    notify: top.notify || notify,
    status: top.status,
  };

  /**
   * We want to always combine top count and notify with children. However,
   * in cases where sumContents is false, we only want to combine status if
   * a child is notify.
   */
  if (sumCounts) {
    combined.status = combineStatus(top.status, status);
  } else {
    combined.status = combineStatus(top.status, notify ? status : 'read');
  }

  return combined;
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
    status: getUnreadStatus(topCount, topNotify),
  };

  return {
    ...top,
    parents: [],
    children: summary.children,
    recency: summary.recency,
    readTimeout: 0,
    summary,
    combined: sumChildren(
      summary.children || {},
      unreads,
      top,
      shouldBeCombined(source)
    ),
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

function updateParents(parents: string[], draft: UnreadsStore) {
  parents.forEach((parent) => {
    const parentSrc = draft.sources[parent];
    if (!parentSrc) {
      return;
    }

    const combined = sumChildren(
      parentSrc.children || {},
      draft.sources,
      parentSrc,
      shouldBeCombined(parent)
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
            unreadStoreLogger.log('update', key, { ...source }, { ...summary });
            const unread = getUnread(key, summary, draft.sources);
            unreadStoreLogger.log('new unread', key, unread);
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
        const source = draft.sources[key];
        if (!source || source.status !== 'unread') {
          return;
        }

        unreadStoreLogger.log('seen', key);
        draft.sources[key] = {
          ...source,
          status: 'seen',
          combined: sumChildren(
            source.children || {},
            draft.sources,
            {
              count: source.count,
              notify: source.notify,
              status: 'seen',
            },
            shouldBeCombined(key)
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
        if (!source || source.status === 'read') {
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
          combined: sumChildren(
            source.children || {},
            draft.sources,
            {
              count: source.count,
              notify: source.notify,
              status: 'read',
            },
            shouldBeCombined(key)
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
    if (source.status === 'read') {
      return;
    }

    if (source.readTimeout) {
      clearTimeout(source.readTimeout);
    }

    const readTimeout = setTimeout(() => {
      unreadStoreLogger.log('delayedRead timeout reached', key);
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

        return {
          unread: acc.unread || source.combined.status === 'unread',
          count: acc.count + source.count,
          notify: acc.notify || source.combined.notify,
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
