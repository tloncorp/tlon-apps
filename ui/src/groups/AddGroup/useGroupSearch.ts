import { useGroupIndex } from '@/state/groups';
import { useConnectivityCheck } from '@/state/vitals';
import { preSig } from '@urbit/api';
import { isValidPatp } from 'urbit-ob';

export interface SearchResult {
  flags: string[];
  loading: boolean;
  isValidShortcode: boolean;
  hostMayBeOffline: boolean;
}

export default function useGroupSearch(query: string): SearchResult {
  const inputIsShortcode = query.includes('/');
  const [rawShip, name] = query?.split('/') ?? [];
  const potentialShip =
    rawShip && isValidPatp(preSig(rawShip)) ? preSig(rawShip) : '';
  const potentialFlag =
    potentialShip && inputIsShortcode ? preSig(`${potentialShip}/${name}`) : '';

  const { groupIndex, fetchStatus } = useGroupIndex(potentialShip);
  const { data } = useConnectivityCheck(potentialShip);

  const flags = Object.entries(groupIndex || {})
    .filter(([flag, preview]) => {
      // Hide secret gangs
      if ('afar' in preview.cordon) {
        return false;
      }

      // Filter out ones that don't match
      if (inputIsShortcode) {
        return flag.startsWith(potentialFlag);
      }

      return true;
    })
    .map(([flag, _preview]) => flag);

  return {
    flags,
    loading: fetchStatus === 'fetching',
    isValidShortcode: !!(inputIsShortcode && potentialShip),
    hostMayBeOffline: !data || !data.status || 'pending' in data.status,
  };
}
