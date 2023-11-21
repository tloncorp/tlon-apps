import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import api from '@/api';
import queryClient from '@/queryClient';
import { MatchingEvent, MatchingResponse } from '@/types/negotiation';

function negotiationUpdater(
  event: MatchingEvent | null,
  queryKey: string[],
  invalidate: React.MutableRefObject<() => void>
) {
  if (event && event.match === true) {
    queryClient.setQueryData(queryKey, (prev: MatchingResponse | undefined) => {
      if (prev === undefined) {
        return prev;
      }

      const newPrev = { ...prev };

      newPrev[event.gill] = 'match';

      return newPrev;
    });
  } else if (event && event.match === false) {
    queryClient.setQueryData(queryKey, (prev: MatchingResponse | undefined) => {
      if (prev === undefined) {
        return prev;
      }

      const newPrev = { ...prev };

      newPrev[event.gill] = 'clash';

      return newPrev;
    });
  }

  invalidate.current();
}

export function useNegotiation(app: string, agent: string) {
  const queryKey = useMemo(() => ['negotiation', app], [app]);

  const invalidate = useRef(
    debounce(
      () => {
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      },
      300,
      {
        leading: true,
        trailing: true,
      }
    )
  );

  useEffect(() => {
    api.subscribe({
      app,
      path: `/~/negotiate/notify/json`,
      event: (event) => negotiationUpdater(event, queryKey, invalidate),
    });
  }, [agent, app, queryKey]);

  return useQuery<MatchingResponse>({
    queryKey,
    queryFn: () =>
      api.scry({
        app,
        path: '/~/negotiate/status/json',
      }),
  });
}

export function useNegotiate(ship: string, app: string, agent: string) {
  const { data, ...rest } = useNegotiation(app, agent);

  if (rest.isLoading || rest.isError || data === undefined) {
    return { ...rest, status: 'await', matchedOrPending: true };
  }

  const isInData = `${ship}/${agent}` in data;

  if (isInData) {
    return {
      ...rest,
      status: data[`${ship}/${agent}`],
      matchedOrPending:
        data[`${ship}/${agent}`] === 'match' ||
        data[`${ship}/${agent}`] === 'await',
    };
  }

  return { ...rest, status: 'await', matchedOrPending: true };
}

export function useNegotiateMulti(ships: string[], app: string, agent: string) {
  const { data, ...rest } = useNegotiation(app, agent);

  if (rest.isLoading || rest.isError || data === undefined) {
    return { ...rest, match: false };
  }

  const allShipsMatch = ships
    .filter((ship) => ship !== window.our)
    .map((ship) => `${ship}/${agent}`)
    .every((ship) => ship in data && data[ship] === 'match');

  return { ...rest, match: allShipsMatch };
}
