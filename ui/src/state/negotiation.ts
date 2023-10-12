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

  const isMatch = `${ship}/${agent}` in data;

  return isMatch;
}
