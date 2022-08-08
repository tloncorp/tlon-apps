import { useCallback, useState } from 'react';
import { useBriefs } from '@/state/chat';
import { ChatWhom } from '@/types/chat';

export const ALPHABETICAL = 'A → Z';
export const DEFAULT = 'Default';
export const RECENT = 'Recent';

type SortMode = typeof ALPHABETICAL | typeof DEFAULT | typeof RECENT;
export interface Sorter {
  (a: string, b: string): number;
}
interface UseSidebarSort {
  defaultSort?: SortMode;
  sortOptions: Record<string, Sorter>;
}

export const sortAlphabetical = (a: ChatWhom, b: ChatWhom) =>
  a.localeCompare(b);

export function useRecentSort() {
  const briefs = useBriefs();
  const sortRecent = useCallback(
    (a: ChatWhom, b: ChatWhom) => {
      const aLast = briefs[a]?.last ?? Number.NEGATIVE_INFINITY;
      const bLast = briefs[b]?.last ?? Number.NEGATIVE_INFINITY;
      if (aLast < bLast) {
        return -1;
      }
      if (aLast > bLast) {
        return 1;
      }
      return 0;
    },
    [briefs]
  );

  return sortRecent;
}

/**
 * This hook implements a few sorting primitives that are consumed via
 * composition in higher order hooks: useChannelSort and useGroupSort
 *
 * @param defaultSort (optional) the initial sorting algorithm; defaults to A-Z
 * @returns an object with sorting functions to be consumed in view components
 */
export default function useSidebarSort({
  defaultSort,
  sortOptions,
}: UseSidebarSort) {
  const [sortFn, setSortFn] = useState<string>(defaultSort || ALPHABETICAL);

  /**
   * Sorts a Record object by an accessed value of T, returns an array of entries
   * @param records An object shaped like { [string]: [T] }, e.g. { "~tlon/group": [{ // Group obj }]}
   * @param accessor Function to get the comparison field
   * @param reverse Whether to reverse the sorted list (ASC --> DEC)
   * @returns [string, T][]
   */
  function sortRecordsBy<T>(
    records: Record<string, T>,
    accessor: (k: string, v: T) => string,
    reverse = false
  ) {
    const entries = Object.entries(records);
    entries.sort(([aKey, aObj], [bKey, bObj]) => {
      const aVal = accessor(aKey, aObj);
      const bVal = accessor(bKey, bObj);

      return sortOptions[sortFn](aVal, bVal);
    });

    return reverse ? entries.reverse() : entries;
  }

  return {
    setSortFn,
    sortFn,
    sortOptions,
    sortRecordsBy,
  };
}
