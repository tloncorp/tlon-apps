import {
  QueryKey,
  UseQueryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import _ from 'lodash';
import { useEffect, useRef } from 'react';

import api from '@/api';
import useSchedulerStore from '@/state/scheduler';

export default function useReactQuerySubscription<T, Event = null>({
  queryKey,
  app,
  path,
  scry,
  scryApp = app,
  priority = 3,
  onEvent,
  onScry,
  options,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  scry: string;
  scryApp?: string;
  priority?: number;
  onEvent?: (data: Event) => void;
  onScry?: (data: T) => T;
  options?: UseQueryOptions<T>;
}) {
  const queryClient = useQueryClient();
  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries(queryKey);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const fetchData = async () =>
    useSchedulerStore.getState().wait(async () => {
      const result = await api.scry<T>({
        app: scryApp,
        path: scry,
      });

      return onScry ? onScry(result) : result;
    }, priority);

  useEffect(() => {
    api.subscribe({
      app,
      path,
      event: onEvent ? onEvent : invalidate.current,
    });
  }, [app, path, queryClient, queryKey, onEvent]);

  return useQuery(queryKey, fetchData, {
    staleTime: 60 * 1000,
    ...options,
  });
}
