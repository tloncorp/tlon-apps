import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { MatchingResponse } from '@/types/negotiation';

export default function useNegotiation(
  ship: string,
  app: string,
  agent: string
) {
  const { data, ...rest } = useReactQuerySubscription<MatchingResponse>({
    queryKey: ['negotiation', app, ship],
    app,
    path: `/~/negotiate/notify/json`,
    scry: '/~/negotiate/matching/json',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return undefined;
  }

  const isInData = `${ship}/${agent}` in data;

  if (isInData) {
    return data[`${ship}/${agent}`];
  }

  return isInData;
}

export function useNegotiateMulti(ships: string[], app: string, agent: string) {
  const { data, ...rest } = useReactQuerySubscription<MatchingResponse>({
    queryKey: ['negotiation', app, ships.join('/')],
    app,
    path: `/~/negotiate/notify/json`,
    scry: '/~/negotiate/matching/json',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return undefined;
  }

  const allShipsMatch = ships
    .map((ship) => `${ship}/${agent}`)
    .every((ship) => ship in data && data[ship] === true);

  return allShipsMatch;
}
