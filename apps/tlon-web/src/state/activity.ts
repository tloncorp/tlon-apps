import { useMutation } from '@tanstack/react-query';
import {
  ActivityAction,
  ActivityReadUpdate,
  Source,
  Unreads,
} from '@tloncorp/shared/dist/urbit/activity';
import _ from 'lodash';
import { useRef } from 'react';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { nestToFlag, sourceToUnreadKey } from '@/logic/utils';
import queryClient from '@/queryClient';

export function activityAction(action: ActivityAction) {
  return {
    app: 'activity',
    mark: 'activity-action',
    json: action,
  };
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
      queryClient.invalidateQueries(['unreads']);
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
          queryKey: ['unreads'],
          refetchType: 'none',
        });
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const eventHandler = (event: ActivityReadUpdate) => {
    const { source, unread } = event.read;
    const key = sourceToUnreadKey(source);
    if ('dm' in source) {
      useChatStore.getState().handleUnread(key, unread);
    } else {
      const nest = source.channel;
      const [app, flag] = nestToFlag(nest);

      if (app === 'chat') {
        useChatStore.getState().handleUnread(flag, unread);
      }
    }

    queryClient.setQueryData(['unreads'], (d: Unreads | undefined) => {
      if (d === undefined) {
        return undefined;
      }

      const newUnreads = { ...d };

      newUnreads[key] = unread;

      return newUnreads;
    });

    invalidate.current();
  };

  const { data, ...rest } = useReactQuerySubscription<
    Unreads,
    ActivityReadUpdate
  >({
    queryKey: ['unreads'],
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
