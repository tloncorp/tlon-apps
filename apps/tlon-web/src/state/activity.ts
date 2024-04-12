import { useMutation } from '@tanstack/react-query';
import {
  ActivityAction,
  Index,
  UnreadUpdate,
  Unreads,
} from '@tloncorp/shared/dist/urbit/activity';
import _ from 'lodash';
import { useRef } from 'react';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { nestToFlag } from '@/logic/utils';
import queryClient from '@/queryClient';

export function activityAction(action: ActivityAction) {
  return {
    app: 'activity',
    mark: 'activity-action',
    json: action,
  };
}

export function useMarkReadMutation() {
  const mutationFn = async (variables: { index: Index }) => {
    await api.poke(
      activityAction({
        read: { index: variables.index, action: { all: null } },
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

  const eventHandler = (event: UnreadUpdate) => {
    const { index, unread } = event;
    debugger;
    if (!('channel' in index)) {
      return;
    }

    const nest = index.channel;
    if (unread !== null) {
      const [app, flag] = nestToFlag(nest);

      if (app === 'chat') {
        useChatStore
          .getState()
          .handleUnread(flag, unread, () => markRead({ index }));
      }

      queryClient.setQueryData(['unreads'], (d: Unreads | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const newUnreads = { ...d };
        newUnreads[`channel/${nest}`] = unread;

        return newUnreads;
      });
    }

    invalidate.current();
  };

  const { data, ...rest } = useReactQuerySubscription<Unreads, UnreadUpdate>({
    queryKey: ['unreads'],
    app: 'activity',
    path: '/unreads',
    scry: '/unreads',
    onEvent: eventHandler,
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyUnreads;
  }

  return data as Unreads;
}

export function useNotifications() {
  return {};
}
