import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import * as api from '@tloncorp/api';
import { createDevLogger } from '../debug';
import { MatchingEvent, MatchingResponse } from '@tloncorp/api/urbit/negotiation';
import { queryClient } from './reactQuery';

const logger = createDevLogger('useNegotiation', false);

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

export function useNegotiation(
  app: string,
  agent: string,
  { enabled = true }: { enabled?: boolean } = {}
) {
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
    if (!enabled) return;
    api.subscribe(
      {
        app,
        path: `/~/negotiate/notify/json`,
      },
      (event: MatchingEvent) => negotiationUpdater(event, queryKey, invalidate)
    );
  }, [agent, app, enabled, queryKey]);

  return useQuery<MatchingResponse>({
    queryKey,
    enabled,
    staleTime: 5000,
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
  const status = data[`${ship}/${agent}`];
  const matchedOrPending =
    data[`${ship}/${agent}`] === 'match' ||
    data[`${ship}/${agent}`] === 'await';

  logger.log(
    'Negotiation data:',
    status,
    matchedOrPending,
    JSON.stringify(data)
  );
  if (isInData) {
    return {
      ...rest,
      status,
      matchedOrPending,
    };
  }

  return { ...rest, status: 'await', matchedOrPending: true };
}

export function useNegotiateMulti(ships: string[], app: string, agent: string) {
  const { data, ...rest } = useNegotiation(app, agent);

  if (rest.isLoading || rest.isError || data === undefined) {
    return { ...rest, matchedOrPending: true };
  }

  const us = api.getCurrentUserId();

  const shipKeys = ships
    .filter((ship) => ship !== us)
    .map((ship) => `${ship}/${agent}`);

  const allShipsMatchOrPending = shipKeys.every(
    (ship) => ship in data && (data[ship] === 'match' || data[ship] === 'await')
  );

  const haveAllNegotiations = shipKeys.every((ship) => ship in data);

  return {
    ...rest,
    matchedOrPending: allShipsMatchOrPending && haveAllNegotiations,
  };
}

export function useGroupsNegotiationClashes({
  enabled = true,
}: { enabled?: boolean } = {}): string[] {
  const { data } = useNegotiation('groups', 'groups', { enabled });
  return useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .filter(([key, status]) => status === 'clash' && key.endsWith('/groups'))
      .map(([key]) => key.replace('/groups', ''));
  }, [data]);
}

export function useForceNegotiationUpdate(ships: string[], app: string) {
  const { data } = useNegotiation(app, app);
  const unknownShips = useMemo(
    () =>
      ships.filter(
        (ship) =>
          !data ||
          !(`${ship}/${app}` in data) ||
          data[`${ship}/${app}`] !== 'match'
      ),
    [ships, app, data]
  );
  const negotiateUnknownShips = useCallback(
    async (shipsToCheck: string[]) => {
      const responses: Promise<number | undefined>[] = [];
      shipsToCheck.forEach((ship) => {
        responses.push(
          api.poke({
            app,
            mark: 'chat-negotiate',
            json: ship,
          })
        );
      });
      await Promise.all(responses);
    },
    [app]
  );

  useEffect(() => {
    if (unknownShips.length > 0) {
      negotiateUnknownShips(unknownShips);
    }
  }, [unknownShips, negotiateUnknownShips]);
}
