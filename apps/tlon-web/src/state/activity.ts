import { useMutation } from '@tanstack/react-query';
import {
  ActivityAction,
  ActivityReadUpdate,
  ActivityUpdate,
  ActivityVolumeUpdate,
  Source,
  Unread,
  Unreads,
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
import { nestToFlag } from '@/logic/utils';
import queryClient from '@/queryClient';

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
  const chat: Record<string, Unread> = {};
  const unreads: Record<string, Unread> = {};

  events.forEach((event) => {
    const { source, unread } = event.read;
    if ('base' in source || 'group' in source) {
      return;
    }

    debugger;
    if ('dm' in source) {
      const whom = 'club' in source.dm ? source.dm.club : source.dm.ship;
      chat[whom] = unread;
      unreads[whom] = unread;
      return;
    }

    if ('dm-thread' in source) {
      const { key, whom } = source['dm-thread'];
      const prefix = 'club' in whom ? whom.club : whom.ship;
      const srcStr = `${prefix}/${key.id}`;

      chat[srcStr] = unread;
      unreads[srcStr] = unread;
    }

    if ('channel' in source) {
      const { nest } = source.channel;
      const [app, flag] = nestToFlag(nest);

      if (app === 'chat') {
        chat[flag] = unread;
      }

      unreads[nest] = unread;
    }

    if ('thread' in source) {
      console.log(source, unread);
      const { key, channel } = source.thread;
      const [app, flag] = nestToFlag(channel);
      const srcStr = `${flag}/${key.id}`;

      if (app === 'chat') {
        chat[srcStr] = unread;
      }

      unreads[`${app}/${srcStr}`] = unread;
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
  console.log('checking read events', readEvents);
  if (readEvents.length > 0) {
    const { chat, unreads } = activityReadUpdates(readEvents);
    useChatStore.getState().update(chat);
    queryClient.setQueryData(['unreads'], (d: Unreads | undefined) => {
      if (d === undefined) {
        return undefined;
      }

      return unreads;
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
    console.log('received activity', event);
    setEventQueue((prev) => [...prev, event]);
  }, []);
  console.log('events', eventQueue);

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
        console.log('processing events', events);
        processActivityUpdates(events);
        setEventQueue([]);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  useEffect(() => {
    console.log('checking queue', eventQueue.length);
    if (eventQueue.length === 0) {
      return;
    }

    console.log('attempting to process queue', eventQueue.length);
    processQueue.current(eventQueue);
  }, [eventQueue]);
}

export function useMarkReadMutation() {
  const mutationFn = async (variables: { source: Source }) => {
    await api.poke(
      activityAction({
        read: { source: variables.source, action: { all: null } },
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

const emptyUnreads: Unreads = {};
export function useUnreads(): Unreads {
  const { data, ...rest } = useReactQueryScry<Unreads>({
    queryKey: unreadsKey,
    app: 'activity',
    path: '/unreads',
    onScry: stripPrefixes,
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyUnreads;
  }

  return data as Unreads;
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