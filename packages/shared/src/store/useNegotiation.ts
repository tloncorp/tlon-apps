import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import * as api from '../api';
import { queryClient } from '../api';
import { MatchingEvent, MatchingResponse } from '../urbit/negotiation';

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
    api.subscribe(
      {
        app,
        path: `/~/negotiate/notify/json`,
      },
      (event: MatchingEvent) => negotiationUpdater(event, queryKey, invalidate)
    );
  }, [agent, app, queryKey]);

  return useQuery<MatchingResponse>({
    queryKey,
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
    return { ...rest, match: false, haveAllNegotiations: false };
  }

  const us = api.getCurrentUserId();

  const shipKeys = ships
    .filter((ship) => ship !== us)
    .map((ship) => `${ship}/${agent}`);

  const allShipsMatch = shipKeys.every(
    (ship) => ship in data && data[ship] === 'match'
  );

  const haveAllNegotiations = shipKeys.every((ship) => ship in data);

  return { ...rest, match: allShipsMatch, haveAllNegotiations };
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
