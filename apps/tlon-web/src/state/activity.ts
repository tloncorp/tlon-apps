import { useMutation } from '@tanstack/react-query';
import {
  Activity,
  ActivityAction,
  ActivityDeleteUpdate,
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

import { useUnreadsStore } from './unreads';

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
  const unreads: Record<string, ActivitySummary> = {};

  events.forEach((event) => {
    const { source, activity } = event.read;
    if ('base' in source) {
      return;
    }

    unreads[sourceToString(source)] = activity;
  });

  return unreads;
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

function processActivityUpdates(updates: ActivityUpdate[]) {
  const readEvents = updates.filter((e) => 'read' in e) as ActivityReadUpdate[];
  actLogger.log('checking read events', readEvents);
  if (readEvents.length > 0) {
    const unreads = activityReadUpdates(readEvents);
    useUnreadsStore.getState().update(unreads);
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
    console.log('new volumes', volumes);
    queryClient.setQueryData<VolumeSettings>(volumeKey, (v) =>
      v === undefined ? undefined : { ...v, ...volumes }
    );
  }

  const delEvents = updates.filter((e) => 'del' in e) as ActivityDeleteUpdate[];
  if (delEvents.length > 0) {
    queryClient.setQueryData(unreadsKey, (unreads: Activity | undefined) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries(unreadsKey, undefined, {
        cancelRefetch: true,
      });
    },
  });
}

const emptyUnreads: Activity = {};
export function useUnreads(): Activity {
  const { data, ...rest } = useReactQueryScry<Activity>({
    queryKey: unreadsKey,
    app: 'activity',
    path: '/activity',
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
