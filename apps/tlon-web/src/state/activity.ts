import { useMutation } from '@tanstack/react-query';
import {
  Activity,
  ActivityAction,
  ActivityReadUpdate,
  ActivitySummary,
  ActivityUpdate,
  ActivityVolumeUpdate,
  ReadAction,
  Source,
  VolumeMap,
  VolumeSettings,
  sourceToString,
  stripPrefixes,
} from '@tloncorp/shared/dist/urbit/activity';
import _ from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import useReactQueryScry from '@/logic/useReactQueryScry';
import { createDevLogger, nestToFlag } from '@/logic/utils';
import queryClient from '@/queryClient';

const actLogger = createDevLogger('activity', false);

export const unreadsKey = ['activity', 'unreads'];
export const volumeKey = ['activity', 'volume'];

export function activityAction(action: ActivityAction) {
  return {
    app: 'activity',
    mark: 'activity-action',
    json: action,
  };
}

function activityReadUpdates(events: ActivityReadUpdate[]) {
  const chat: Record<string, ActivitySummary> = {};
  const unreads: Record<string, ActivitySummary> = {};

  events.forEach((event) => {
    const { source, activity } = event.read;
    if ('base' in source || 'group' in source) {
      return;
    }

    if ('dm' in source) {
      const whom = 'club' in source.dm ? source.dm.club : source.dm.ship;
      chat[whom] = activity;
      unreads[whom] = activity;
      return;
    }

    if ('dm-thread' in source) {
      const { key, whom } = source['dm-thread'];
      const prefix = 'club' in whom ? whom.club : whom.ship;
      const srcStr = `${prefix}/${key.id}`;

      chat[srcStr] = activity;
      unreads[srcStr] = activity;
    }

    if ('channel' in source) {
      const { nest } = source.channel;
      const [app, flag] = nestToFlag(nest);

      if (app === 'chat') {
        chat[flag] = activity;
      }

      unreads[nest] = activity;
    }

    if ('thread' in source) {
      const { key, channel } = source.thread;
      const [app, flag] = nestToFlag(channel);
      const srcStr = `${flag}/${key.id}`;

      if (app === 'chat') {
        chat[srcStr] = activity;
      }

      unreads[`${app}/${srcStr}`] = activity;
    }
  });

  return {
    chat,
    unreads,
  };
}

function activityVolumeUpdates(events: ActivityVolumeUpdate[]) {
  return events.reduce((acc, event) => {
    const { source, volume } = event.adjust;
    // eslint-disable-next-line no-param-reassign
    acc[sourceToString(source, true)] = volume;
    return acc;
  }, {} as VolumeSettings);
}

function processActivityUpdates(updates: ActivityUpdate[]) {
  const readEvents = updates.filter((e) => 'read' in e) as ActivityReadUpdate[];
  actLogger.log('checking read events', readEvents);
  if (readEvents.length > 0) {
    const { chat, unreads } = activityReadUpdates(readEvents);
    useChatStore.getState().update(chat);
    queryClient.setQueryData(unreadsKey, (d: Activity | undefined) => {
      if (d === undefined) {
        return undefined;
      }

      return {
        ...d,
        ...unreads,
      };
    });
  }

  const adjustEvents = updates.filter(
    (e) => 'adjust' in e
  ) as ActivityVolumeUpdate[];
  if (adjustEvents.length > 0) {
    const volumes = activityVolumeUpdates(adjustEvents);
    queryClient.setQueryData<VolumeSettings>(volumeKey, (v) =>
      v === undefined ? undefined : volumes
    );
  }
}

export function useActivityFirehose() {
  const [eventQueue, setEventQueue] = useState<ActivityUpdate[]>([]);
  const eventHandler = useCallback((event: ActivityUpdate) => {
    actLogger.log('received activity', event);
    setEventQueue((prev) => [...prev, event]);
  }, []);
  actLogger.log('events', eventQueue);

  useEffect(() => {
    api.subscribe({
      app: 'activity',
      path: '/',
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

export function useMarkReadMutation() {
  const mutationFn = async (variables: {
    source: Source;
    action?: ReadAction;
  }) => {
    await api.poke(
      activityAction({
        read: {
          source: variables.source,
          action: variables.action || { all: null },
        },
      })
    );
  };

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries(unreadsKey);
    },
  });
}

const emptyUnreads: Activity = {};
export function useUnreads(): Activity {
  const { data, ...rest } = useReactQueryScry<Activity>({
    queryKey: unreadsKey,
    app: 'activity',
    path: '/unreads',
    onScry: stripPrefixes,
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyUnreads;
  }

  return data as Activity;
}

const emptySettings: VolumeSettings = {};
export function useVolumeSettings() {
  const { data, ...rest } = useReactQueryScry<VolumeSettings>({
    queryKey: volumeKey,
    app: 'activity',
    path: '/volume-settings',
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
    mutationFn: async (variables: { source: Source; volume: VolumeMap }) => {
      return api.poke(
        activityAction({
          adjust: variables,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(volumeKey);
    },
  });
}
