import _ from 'lodash';
import {
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import api from '@/api';
import useSchedulerStore from '@/state/scheduler';

export default function useReactQuerySubscription({
  queryKey,
  app,
  path,
  scry,
  scryApp = app,
  priority = 3,
  options,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  scry: string;
  scryApp?: string;
  priority?: number;
  options?: UseQueryOptions;
}): ReturnType<typeof useQuery> {
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
    useSchedulerStore.getState().wait(
      async () =>
        api.scry({
          app: scryApp,
          path: scry,
        }),
      priority
    );

  useEffect(() => {
    api.subscribe({
      app,
      path,
      event: invalidate.current,
    });
  }, [app, path, queryClient, queryKey]);

  return useQuery(queryKey, fetchData, {
    retryOnMount: false,
    refetchOnMount: false,
    ...options,
  });
}
