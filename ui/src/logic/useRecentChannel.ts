import { useLocalStorage } from 'usehooks-ts';
import { createStorageKey } from './utils';

/**
 * Tracks which channel was most recently visited
 * @param flag The group flag
 */
export default function useRecentChannel(flag: string) {
  const [recentChannel, setRecentChannel] = useLocalStorage(
    createStorageKey(`recent-chan:${flag}`),
    ''
  );

  return { recentChannel, setRecentChannel };
}
