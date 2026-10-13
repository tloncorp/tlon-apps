import {
  QueryKey,
  UseQueryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { One, Params } from '@tloncorp/api/client/requests';
import _ from 'lodash';
import { useEffect, useRef } from 'react';

import api, { type Registered } from '@/api';
import useSchedulerStore from '@/state/scheduler';

export default function useReactQuerySubscription<
  E extends Registered<'scry'>,
  S extends Registered<'subscribe'>,
  T = unknown,
  Event = null,
>({
  queryKey,
  scry,
  scryParams,
  watch,
  watchParams,
  priority = 3,
  onEvent,
  onScry,
  options,
}: {
  queryKey: QueryKey;
  scry: One<E>;
  scryParams: Params<E['path']>;
  watch: One<S>;
  watchParams: Params<S['path']>;
  priority?: number;
  onEvent?: (data: Event) => void;
  onScry?: (data: T) => T;
  options?: UseQueryOptions<T>;
}) {
  const queryClient = useQueryClient();
  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({ queryKey: queryKey });
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const fetchData = async () =>
    useSchedulerStore.getState().wait(async () => {
      const result = await api.scryEntry(scry)<T>(scryParams);

      return onScry ? onScry(result) : result;
    }, priority);

  useEffect(() => {
    api.subscribeEntry(watch)(watchParams, {
      event: onEvent ? onEvent : invalidate.current,
    });
  }, [watch, watchParams, queryClient, queryKey, onEvent]);

  return useQuery({
    queryKey,
    queryFn: fetchData,
    staleTime: 60 * 1000,
    ...options,
  });
}
