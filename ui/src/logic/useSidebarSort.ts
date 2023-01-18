import { useCallback, useMemo } from 'react';
import {
  SettingsState,
  useSettingsState,
  useGroupSideBarSort,
} from '@/state/settings';
import useAllBriefs from './useAllBriefs';

export const ALPHABETICAL = 'A → Z';
export const DEFAULT = 'Arranged';
export const RECENT = 'Recent';

type SortMode = typeof ALPHABETICAL | typeof DEFAULT | typeof RECENT;
export interface Sorter {
  (a: string, b: string): number;
}
interface UseSidebarSort {
  defaultSort?: SortMode;
  sortOptions: Record<string, Sorter>;
  flag?: string;
}

export const sortAlphabetical = (aNest: string, bNest: string) =>
  aNest.localeCompare(bNest);

const selSideBarSort = (s: SettingsState) => ({
  sideBarSort: s.groups.sideBarSort,
});

export function useRecentSort() {
  const briefs = useAllBriefs();
  const sortRecent = useCallback(
    (aNest: string, bNest: string) => {
      const aLast = briefs[aNest]?.last ?? Number.NEGATIVE_INFINITY;
      const bLast = briefs[bNest]?.last ?? Number.NEGATIVE_INFINITY;
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
 * @returns an object with sorting functions to be consumed in view components
 */
export default function useSidebarSort({
  defaultSort,
  sortOptions,
  flag = '~',
}: UseSidebarSort) {
  const { sideBarSort } = useSettingsState(selSideBarSort);
  const groupSideBarSort = useGroupSideBarSort();
  const sortFn = defaultSort || groupSideBarSort[flag] || sideBarSort;

  const setSideBarSort = (mode: string) => {
    useSettingsState.getState().putEntry('groups', 'sideBarSort', mode);
  };

  const setGroupSideBarSort = useCallback(
    () => (mode: string) => {
      useSettingsState
        .getState()
        .putEntry(
          'groups',
          'groupSideBarSort',
          JSON.stringify({ [flag]: mode })
        );
    },
    [flag]
  );

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

      const sorter = sortOptions[sortFn] ?? sortOptions[ALPHABETICAL];
      return sorter(aVal, bVal);
    });

    return reverse ? entries.reverse() : entries;
  }

  const setSortFn = useMemo(
    () => (flag !== '~' ? setGroupSideBarSort : setSideBarSort),
    [flag, setGroupSideBarSort]
  );

  return {
    setSortFn,
    sortFn,
    sortOptions,
    sortRecordsBy,
  };
}
