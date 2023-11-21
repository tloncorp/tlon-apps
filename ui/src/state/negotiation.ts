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
    return { ...rest, match: false };
  }

  const isInData = `${ship}/${agent}` in data;

  if (isInData) {
    return { ...rest, match: data[`${ship}/${agent}`] };
  }

  return { ...rest, match: false };
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
    .filter((ship) => ship !== window.our)
    .map((ship) => `${ship}/${agent}`)
    .every((ship) => ship in data && data[ship] === true);

  return allShipsMatch;
}
