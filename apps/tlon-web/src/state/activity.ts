import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import {
  Activity,
  ActivityAction,
  ActivityDeleteUpdate,
  ActivityFeed,
  ActivityReadUpdate,
  ActivitySummary,
  ActivitySummaryUpdate,
  ActivityUpdate,
  ActivityVolumeUpdate,
  ChannelSource,
  DmSource,
  ReadAction,
  Source,
  VolumeMap,
  VolumeSettings,
  getKey,
  getThreadKey,
  sourceToString,
  stripSourcePrefix,
} from '@tloncorp/shared/dist/urbit/activity';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import useReactQueryScry from '@/logic/useReactQueryScry';
import { createDevLogger, whomIsDm, whomIsFlag } from '@/logic/utils';
import queryClient from '@/queryClient';

import { useLocalState } from './local';
import { SidebarFilter } from './settings';

const actLogger = createDevLogger('activity', false);

export const unreadsKey = (...args: string[]) => [
  'activity',
  'unreads',
  ...args,
];
export const volumeKey = ['activity', 'volume'];
export const allKey = ['activity', 'all'];

export function activityAction(action: ActivityAction) {
  return {
    app: 'activity',
    mark: 'activity-action',
    json: action,
  };
}

function activityReadUpdates(events: ActivityReadUpdate[]) {
  const main: Record<string, ActivitySummary> = {};
  const threads: Record<string, Record<string, ActivitySummary>> = {};

  events.forEach((event) => {
    const { source, activity } = event.read;

    if ('thread' in source) {
      const channel = {
        channel: {
          group: source.thread.group,
          nest: source.thread.channel,
        },
      };
      const channelSrc = sourceToString(channel);
      threads[channelSrc] = {
        ...threads[channelSrc],
        [sourceToString(source)]: activity,
      };
    } else if ('dm-thread' in source) {
      const { whom } = source['dm-thread'];
      const dm = { dm: whom };
      const dmSrc = sourceToString(dm);
      threads[dmSrc] = {
        ...threads[dmSrc],
        [sourceToString(source)]: activity,
      };
    } else {
      main[sourceToString(source)] = activity;
    }
  });

  return { main, threads };
}

function activitySummaryUpdates(events: ActivitySummaryUpdate[]) {
  const main: Record<string, ActivitySummary> = {};
  const threads: Record<string, Record<string, ActivitySummary>> = {};

  events.forEach((event) => {
    Object.entries(event.activity).forEach(([source, summary]) => {
      if (source.startsWith('thread/')) {
        const channelSrc = source.replace(
          /thread\/([a-z]+\/~[a-z-]+\/[a-z]+[a-z0-9-]*)\/.*/,
          'channel/$1'
        );
        threads[channelSrc] = {
          ...threads[channelSrc],
          [source]: summary,
        };
      } else if (source.startsWith('dm-thread/')) {
        const pattern = /dm-thread\/((?:[a-z]|[\d.~-])*).*/;
        const dmSrc = source.startsWith('dm-thread/~')
          ? source.replace(pattern, 'ship/$1')
          : source.replace(pattern, 'club/$1');
        threads[dmSrc] = {
          ...threads[dmSrc],
          [source]: summary,
        };
      } else {
        main[source] = summary;
      }
    });
  });

  return { main, threads };
}

function activityVolumeUpdates(events: ActivityVolumeUpdate[]) {
  return events.reduce((acc, event) => {
    const { source, volume } = event.adjust;
    if (volume === null) {
      return acc;
    }

    // eslint-disable-next-line no-param-reassign
    acc[sourceToString(source)] = volume;
    return acc;
  }, {} as VolumeSettings);
}

function optimisticActivityUpdate(
  d: Activity | undefined,
  source: string
): Activity | undefined {
  if (!d) {
    return d;
  }

  const old = d[source];
  return {
    ...d,
    [source]: {
      ...old,
      unread: null,
      count: Math.min(0, old.count - (old.unread?.count || 0)),
      'notify-count':
        old.unread && old.unread.notify
          ? Math.min(0, old['notify-count'] - old.unread.count)
          : old['notify-count'],
    },
  };
}

function isRead(summary: ActivitySummary) {
  return summary.unread === null;
}

function updateActivity({
  main,
  threads,
}: {
  main: Activity;
  threads: Record<string, Activity>;
}) {
  const { current, currentThread, atBottom, atThreadBottom } =
    useChatStore.getState();
  const source = current ? getKey(current.whom) : null;
  const threadSource =
    current && currentThread
      ? getThreadKey(
          current.whom,
          whomIsFlag(current.whom) ? currentThread.time : currentThread.id
        )
      : null;
  const threadActivity = source ? threads[source] || null : null;
  const inFocus = useLocalState.getState().inFocus;
  const filteredMain =
    inFocus &&
    atBottom &&
    source &&
    source in main &&
    threadActivity === null &&
    !isRead(main[source])
      ? optimisticActivityUpdate(main, source)
      : undefined;
  const filteredThread =
    inFocus &&
    atThreadBottom &&
    threadActivity &&
    threadSource &&
    threadSource in threadActivity &&
    !isRead(threadActivity[threadSource])
      ? optimisticActivityUpdate(threadActivity, threadSource)
      : undefined;

  if (filteredMain && current) {
    const nest = `chat/${current.whom}`;
    const source = whomIsFlag(current.whom)
      ? current.group
        ? { channel: { group: current.group, nest } }
        : null
      : {
          dm: whomIsDm(current.whom)
            ? { ship: current.whom }
            : { club: current.whom },
        };

    if (source) {
      api.poke<ActivityAction>(
        activityAction({
          read: { source, action: { all: { time: null, deep: false } } },
        })
      );
    }
  }

  if (filteredThread && current && currentThread) {
    const nest = `chat/${current.whom}`;
    const source = whomIsFlag(current.whom)
      ? current.group
        ? {
            thread: { group: current.group, channel: nest, key: currentThread },
          }
        : null
      : {
          'dm-thread': {
            whom: whomIsDm(current.whom)
              ? { ship: current.whom }
              : { club: current.whom },
            key: currentThread,
          },
        };

    if (source) {
      api.poke<ActivityAction>(
        activityAction({
          read: { source, action: { all: { time: null, deep: false } } },
        })
      );
    }
  }

  queryClient.setQueryData(unreadsKey(), (d: Activity | undefined) => {
    return {
      ...d,
      ...(filteredMain ? filteredMain : main),
    };
  });

  Object.entries(threads).forEach(([key, value]) => {
    queryClient.setQueryData(
      unreadsKey('threads', key),
      (d: Activity | undefined) => {
        return {
          ...d,
          ...(filteredThread && key === source ? filteredThread : value),
        };
      }
    );
  });
}

function processActivityUpdates(updates: ActivityUpdate[]) {
  const summaryEvents = updates.filter(
    (e) => 'activity' in e
  ) as ActivitySummaryUpdate[];
  if (summaryEvents.length > 0) {
    updateActivity(activitySummaryUpdates(summaryEvents));
  }

  const readEvents = updates.filter((e) => 'read' in e) as ActivityReadUpdate[];
  actLogger.log('checking read events', readEvents);
  if (readEvents.length > 0) {
    updateActivity(activityReadUpdates(readEvents));
  }

  const adjustEvents = updates.filter(
    (e) => 'adjust' in e
  ) as ActivityVolumeUpdate[];
  if (adjustEvents.length > 0) {
    const volumes = activityVolumeUpdates(adjustEvents);
    console.log('new volumes', volumes);
    queryClient.setQueryData<VolumeSettings>(volumeKey, (v) =>
      v === undefined ? undefined : { ...v, ...volumes }
    );
  }

  const delEvents = updates.filter((e) => 'del' in e) as ActivityDeleteUpdate[];
  if (delEvents.length > 0) {
    queryClient.setQueryData(unreadsKey(), (unreads: Activity | undefined) => {
      if (unreads === undefined) {
        return undefined;
      }

      return delEvents.reduce((acc, event) => {
        const source = sourceToString(event.del, true);
        delete acc[source];
        return acc;
      }, unreads);
    });
  }

  queryClient.invalidateQueries(allKey);
}

export function useActivityFirehose() {
  const [eventQueue, setEventQueue] = useState<ActivityUpdate[]>([]);
  const eventHandler = useCallback(
    (event: ActivityUpdate) => {
      actLogger.log('received activity', event);
      setEventQueue((prev) => [...prev, event]);
    },
    [setEventQueue]
  );
  actLogger.log('events', eventQueue);

  useEffect(() => {
    api.subscribe({
      app: 'activity',
      path: '/v4',
      event: eventHandler,
    });
  }, [eventHandler]);

  const processQueue = useRef(
    _.debounce(
      (events: ActivityUpdate[]) => {
        actLogger.log('processing events', events);
        processActivityUpdates(events);
        setEventQueue([]);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  useEffect(() => {
    actLogger.log('checking queue', eventQueue.length);
    if (eventQueue.length === 0) {
      return;
    }

    actLogger.log('attempting to process queue', eventQueue.length);
    processQueue.current(eventQueue);
  }, [eventQueue]);
}

type PageParam = string | null;

export function useAllEvents() {
  const queryFn = useCallback(({ pageParam }: { pageParam?: PageParam }) => {
    return api.scry<ActivityFeed>({
      app: 'activity',
      path: `/v5/feed/all/50${pageParam ? `/${pageParam}` : ''}`,
    });
  }, []);
  return useInfiniteQuery({
    queryKey: allKey,
    queryFn,
    getNextPageParam: (lastPage) => {
      if (lastPage.feed.length === 0) {
        return null;
      }

      return lastPage.feed[lastPage.feed.length - 1].latest;
    },
  });
}

export function useMarkReadMutation(recursive = false) {
  const mutationFn = async (variables: {
    source: Source;
    action?: ReadAction;
  }) => {
    await api.poke(
      activityAction({
        read: {
          source: variables.source,
          action: variables.action || { all: { time: null, deep: recursive } },
        },
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const current = queryClient.getQueryData<Activity>(unreadsKey());
      queryClient.setQueryData<Activity>(unreadsKey(), (d) => {
        if (d === undefined) {
          return undefined;
        }

        if (!variables.action || !('all' in variables.action)) {
          return d;
        }

        const source = sourceToString(variables.source);
        if (variables.action.all.deep) {
          return {
            ...d,
            [source]: {
              ...d[source],
              unread: null,
              count: 0,
              notify: false,
              'notify-count': 0,
            },
          };
        }

        return optimisticActivityUpdate(d, source);
      });

      return { current };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(unreadsKey(), context?.current);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: unreadsKey(),
        refetchType: 'none',
      });
    },
  });
}

export function useActivity() {
  const { data, ...rest } = useReactQueryScry<Activity>({
    queryKey: unreadsKey(),
    app: 'activity',
    path: '/v4/activity',
    options: {
      placeholderData: {},
    },
  });

  return {
    ...rest,
    // data is always an object since we set placeholder data
    activity: data!,
  };
}

export const emptySummary: ActivitySummary = {
  recency: 0,
  count: 0,
  notify: false,
  unread: null,
  'notify-count': 0,
};

export function useSourceActivity(source: string) {
  const { activity, ...rest } = useActivity();
  return {
    ...rest,
    activity: activity[source] || emptySummary,
  };
}

export function useThreadActivity(
  source: DmSource | ChannelSource,
  key: string
) {
  const src = sourceToString(source);
  const queryKey = unreadsKey('threads', src);
  const { data, ...rest } = useReactQueryScry<Activity>({
    queryKey,
    app: 'activity',
    path:
      'channel' in source
        ? `/v4/activity/threads/${source.channel.group}/${source.channel.nest}`
        : `/v4/activity/dm-threads/${'ship' in source.dm ? source.dm.ship : source.dm.club}`,
    options: {
      placeholderData: {},
    },
  });

  return {
    ...rest,
    activity: data?.[key] || emptySummary,
  };
}

const emptySettings: VolumeSettings = {};
export function useVolumeSettings() {
  const { data, ...rest } = useReactQueryScry<VolumeSettings>({
    queryKey: volumeKey,
    app: 'activity',
    path: '/volume-settings',
    options: {
      keepPreviousData: true,
    },
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return {
      ...rest,
      data: emptySettings,
    };
  }

  return {
    ...rest,
    data,
  };
}

export function useVolume(source?: Source) {
  const { data, ...rest } = useVolumeSettings();
  if (data === undefined || source === undefined) {
    return {
      ...rest,
      volume: 'default',
    };
  }

  return {
    ...rest,
    volume: data[sourceToString(source)],
  };
}

export function useVolumeAdjustMutation() {
  return useMutation({
    mutationFn: async (variables: {
      source: Source;
      volume: VolumeMap | null;
    }) => {
      return api.poke(
        activityAction({
          adjust: variables,
        })
      );
    },
    onMutate: async (variables) => {
      const current = queryClient.getQueryData<VolumeSettings>(volumeKey);
      queryClient.setQueryData<VolumeSettings>(volumeKey, (v) => {
        if (v === undefined) {
          return undefined;
        }

        return {
          ...v,
          [sourceToString(variables.source)]: variables.volume,
        };
      });

      return current;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(volumeKey);
    },
  });
}

const defaultUnread = {
  unread: false,
  count: 0,
  notify: false,
};
export function useCombinedChatUnreads(messagesFilter: SidebarFilter) {
  const { activity } = useActivity();
  return useMemo(
    () =>
      Object.entries(activity).reduce((acc, [key, source]) => {
        const isDm = key.startsWith('ship/') || key.startsWith('club/');
        const isChat = key.startsWith('channel/chat');
        const dms = messagesFilter === 'Direct Messages' && isDm;
        const chats = messagesFilter === 'Group Channels' && isChat;
        const all = messagesFilter === 'All Messages' && (isDm || isChat);

        if (!(dms || chats || all)) {
          return acc;
        }

        return {
          unread: acc.unread || source.count > 0,
          count: acc.count + source.count,
          notify: acc.notify || source.notify,
        };
      }, defaultUnread),
    [activity, messagesFilter]
  );
}

export function useMarkAllGroupsRead() {
  const { activity } = useActivity();
  const { mutate } = useMarkReadMutation(true);

  const markAllRead = useCallback(() => {
    Object.entries(activity)
      .filter(([key]) => key.startsWith('group'))
      .forEach(([sourceId]) => {
        mutate({ source: { group: stripSourcePrefix(sourceId) } });
      });
  }, [activity, mutate]);

  return markAllRead;
}

export function useCombinedGroupUnreads() {
  const { activity } = useActivity();
  return Object.entries(activity).reduce((acc, [key, source]) => {
    if (!key.startsWith('group')) {
      return acc;
    }

    return {
      unread: acc.unread || source.count > 0,
      count: acc.count + source.count,
      notify: acc.notify || source.notify,
    };
  }, defaultUnread);
}

export function useOptimisticMarkRead(source: string) {
  return useCallback(() => {
    queryClient.setQueryData<Activity>(unreadsKey(), (d) => {
      if (d === undefined) {
        return undefined;
      }

      return {
        ...d,
        [source]: {
          ...d[source],
          unread: null,
          count: 0,
          notify: false,
          'notify-count': 0,
        },
      };
    });
  }, [source]);
}
