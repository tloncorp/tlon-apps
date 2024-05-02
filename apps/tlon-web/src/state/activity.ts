import { useMutation } from '@tanstack/react-query';
import {
  ActivityAction,
  ActivityReadUpdate,
  ActivityUpdate,
  ActivityVolumeUpdate,
  Source,
  Unread,
  Unreads,
  Volume,
  VolumeMap,
  VolumeSettings,
  sourceToString,
} from '@tloncorp/shared/dist/urbit/activity';
import _ from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { nestToFlag, sourceToUnreadKey } from '@/logic/utils';
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
    if (!('dm' in source) && !('channel' in source)) {
      return;
    }

    if ('dm' in source) {
      const whom = 'club' in source.dm ? source.dm.club : source.dm.ship;
      unreads[whom] = unread;
      return;
    }

    const { nest } = source.channel;
    const [app, flag] = nestToFlag(nest);

    if (app === 'chat') {
      chat[flag] = unread;
    } else {
      unreads[nest] = unread;
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
    setEventQueue((prev) => [...prev, event]);
  }, []);

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
        processActivityUpdates(events);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  useEffect(() => {
    if (eventQueue.length === 0) {
      return;
    }

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
  const { mutate: markRead } = useMarkReadMutation();
  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({
          queryKey: unreadsKey,
          refetchType: 'none',
        });
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const eventHandler = (event: ActivityReadUpdate) => {
    const { source, unread } = event.read;
    let whom = '';

    if ('dm' in source) {
      whom = 'club' in source.dm ? source.dm.club : source.dm.ship;
      useChatStore.getState().handleUnread(whom, unread);
    }

    if ('channel' in source) {
      const { nest } = source.channel;
      const [app, flag] = nestToFlag(nest);
      whom = nest;

      if (app === 'chat') {
        useChatStore.getState().handleUnread(flag, unread);
      }
    }

    if (whom === '') {
      return;
    }

    queryClient.setQueryData(unreadsKey, (d: Unreads | undefined) => {
      if (d === undefined) {
        return undefined;
      }

      const newUnreads = { ...d };
      newUnreads[whom] = unread;

      return newUnreads;
    });

    invalidate.current();
  };

  const { data, ...rest } = useReactQuerySubscription<
    Unreads,
    ActivityReadUpdate
  >({
    queryKey: unreadsKey,
    app: 'activity',
    path: '/unreads',
    scry: '/unreads',
    onEvent: eventHandler,
    onScry: (d) => {
      return _.mapKeys(d, (v, key) =>
        key.replace(/^(channel|ship|club)\//, '')
      );
    },
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyUnreads;
  }

  return data as Unreads;
}

export function useNotifications() {
  return {};
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
